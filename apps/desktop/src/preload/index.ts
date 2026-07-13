import { contextBridge, ipcRenderer } from 'electron'

type HealthResult = {
  ok: boolean
  service: string
  runtime: string
  timestamp: string
}

type DirectoryResult = {
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

const mediaParserApi = {
  health: (): Promise<HealthResult> => ipcRenderer.invoke('app:health'),
  mediaCoreStatus: () => ipcRenderer.invoke('media-core:status'),
  startMediaCore: () => ipcRenderer.invoke('media-core:start'),
  stopMediaCore: () => ipcRenderer.invoke('media-core:stop'),
  mediaCoreHealth: () => ipcRenderer.invoke('media-core:health'),
  request: (request: MediaCoreRequest) => ipcRenderer.invoke('media-core:request', request),
  parseVideo: (url: string) => ipcRenderer.invoke('media:parse-video', url),
  parsePodcast: (url: string) => ipcRenderer.invoke('media:parse-podcast', url),
  openExternalTarget: (target: string) => ipcRenderer.invoke('app:open-external', target),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  selectDirectory: (): Promise<DirectoryResult> => ipcRenderer.invoke('dialog:select-directory')
}

contextBridge.exposeInMainWorld('mediaParser', mediaParserApi)
