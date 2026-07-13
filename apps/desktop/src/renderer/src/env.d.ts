/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, unknown>
  export default component
}

type MediaParserHealth = {
  ok: boolean
  service: string
  runtime: string
  timestamp: string
}

type DirectorySelection = {
  canceled: boolean
  path: string
}

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

interface Window {
  mediaParser: {
    health: () => Promise<MediaParserHealth>
    mediaCoreStatus: () => Promise<unknown>
    startMediaCore: () => Promise<unknown>
    stopMediaCore: () => Promise<unknown>
    mediaCoreHealth: () => Promise<unknown>
    request: (request: MediaCoreRequest) => Promise<MediaCoreResponse>
    parseVideo: (url: string) => Promise<unknown>
    parsePodcast: (url: string) => Promise<unknown>
    openExternalTarget: (target: 'projectHome' | 'githubReleases') => Promise<unknown>
    checkForUpdates: () => Promise<unknown>
    selectDirectory: () => Promise<DirectorySelection>
  }
}
