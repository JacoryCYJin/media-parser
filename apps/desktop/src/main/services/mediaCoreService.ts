import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

type ServiceStatus = 'stopped' | 'starting' | 'running' | 'failed'

type HealthResult = {
  ok: boolean
  service?: string
  client_id?: string
  status: ServiceStatus
  port: number
  url: string
  error?: string
}

type JsonObject = Record<string, unknown>

type MediaCoreRequest = {
  method?: string
  path: string
  params?: Record<string, string | number | boolean | null | undefined>
  data?: unknown
  headers?: Record<string, string>
}

type MediaCoreResponse = {
  ok: boolean
  status: number
  data: unknown
}

const MEDIA_CORE_PORT = Number(process.env.MEDIA_CORE_PORT || 5011)
const MEDIA_CORE_HOST = process.env.MEDIA_CORE_HOST || '127.0.0.1'
const MEDIA_CORE_URL = `http://${MEDIA_CORE_HOST}:${MEDIA_CORE_PORT}`

let processRef: ChildProcessWithoutNullStreams | null = null
let status: ServiceStatus = 'stopped'
let lastError = ''
const clientId = `u_${randomUUID().replace(/-/g, '')}`

function getWorkspaceMediaCoreRoot(): string {
  if (process.env.MEDIA_CORE_ROOT) return process.env.MEDIA_CORE_ROOT

  if (app.isPackaged) {
    return join(process.resourcesPath, 'media-core')
  }

  return resolve(process.cwd(), '../../services/media-core')
}

function getPythonBin(coreRoot: string): string {
  const venvPython = process.platform === 'win32'
    ? join(coreRoot, '.venv', 'Scripts', 'python.exe')
    : join(coreRoot, '.venv', 'bin', 'python')

  if (existsSync(venvPython)) return venvPython
  return process.env.PYTHON_BIN || 'python3'
}

async function requestJson(path: string, init?: RequestInit): Promise<JsonObject> {
  const headers = new Headers(init?.headers)
  headers.set('x-client-id', clientId)

  const response = await fetch(`${MEDIA_CORE_URL}${path}`, {
    ...init,
    headers
  })
  const data = (await response.json()) as JsonObject

  if (!response.ok) {
    throw new Error(String(data.error || data.message || `HTTP ${response.status}`))
  }

  return data
}

function buildMediaCoreUrl(path: string, params?: MediaCoreRequest['params']): string {
  const url = new URL(path, MEDIA_CORE_URL)

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

function normalizeMediaCoreData(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data

  const normalized = { ...(data as JsonObject) }
  const thumbnailProxy = normalized.thumbnail_proxy

  if (typeof thumbnailProxy === 'string' && thumbnailProxy.startsWith('/')) {
    normalized.thumbnail_proxy = `${MEDIA_CORE_URL}${thumbnailProxy}`
  }

  return normalized
}

export function getMediaCoreStatus() {
  return {
    status,
    port: MEDIA_CORE_PORT,
    url: MEDIA_CORE_URL,
    client_id: clientId,
    pid: processRef?.pid ?? null,
    error: lastError
  }
}

export async function startMediaCore(): Promise<ReturnType<typeof getMediaCoreStatus>> {
  if (processRef && status !== 'failed') return getMediaCoreStatus()

  const existingHealth = await healthMediaCore()
  if (existingHealth.ok) return getMediaCoreStatus()

  const coreRoot = getWorkspaceMediaCoreRoot()
  const pythonBin = getPythonBin(coreRoot)

  status = 'starting'
  lastError = ''

  processRef = spawn(pythonBin, ['run_dev.py'], {
    cwd: coreRoot,
    env: {
      ...process.env,
      MEDIA_CORE_HOST,
      MEDIA_CORE_PORT: String(MEDIA_CORE_PORT),
      PYTHONPATH: coreRoot
    }
  })

  processRef.stdout.on('data', (chunk) => {
    console.info(`[media-core] ${String(chunk).trimEnd()}`)
  })

  processRef.stderr.on('data', (chunk) => {
    console.error(`[media-core] ${String(chunk).trimEnd()}`)
  })

  processRef.on('exit', (code, signal) => {
    if (status !== 'stopped') {
      status = code === 0 ? 'stopped' : 'failed'
      lastError = `media-core exited with code ${code ?? 'null'} signal ${signal ?? 'null'}`
    }
    processRef = null
  })

  await waitForMediaCore()
  return getMediaCoreStatus()
}

export function stopMediaCore(): ReturnType<typeof getMediaCoreStatus> {
  status = 'stopped'
  lastError = ''

  if (processRef) {
    processRef.kill()
    processRef = null
  }

  return getMediaCoreStatus()
}

export async function healthMediaCore(): Promise<HealthResult> {
  try {
    const data = await requestJson('/api/health')
    status = 'running'
    return {
      ...data,
      ok: Boolean(data.ok),
      status,
      port: MEDIA_CORE_PORT,
      url: MEDIA_CORE_URL,
      client_id: clientId
    }
  } catch (error) {
    return {
      ok: false,
      status,
      port: MEDIA_CORE_PORT,
      url: MEDIA_CORE_URL,
      client_id: clientId,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function parseVideo(url: string): Promise<JsonObject> {
  await startMediaCore()
  return requestJson('/api/video/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  })
}

export async function parsePodcast(url: string): Promise<JsonObject> {
  await startMediaCore()
  return requestJson('/api/podcast/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  })
}

export async function requestMediaCore(request: MediaCoreRequest): Promise<MediaCoreResponse> {
  await startMediaCore()

  const method = (request.method || 'GET').toUpperCase()
  const headers = new Headers(request.headers)
  headers.set('x-client-id', headers.get('x-client-id') || clientId)

  const init: RequestInit = { method, headers }

  if (request.data !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json')
    init.body = JSON.stringify(request.data)
  }

  try {
    const response = await fetch(buildMediaCoreUrl(request.path, request.params), init)
    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    return {
      ok: response.ok,
      status: response.status,
      data: normalizeMediaCoreData(data)
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

async function waitForMediaCore(): Promise<void> {
  const deadline = Date.now() + 10_000

  while (Date.now() < deadline) {
    const health = await healthMediaCore()
    if (health.ok) {
      status = 'running'
      return
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 250))
  }

  status = 'failed'
  lastError = 'media-core health check timed out'
  throw new Error(lastError)
}
