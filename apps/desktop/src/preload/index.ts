import { contextBridge, ipcRenderer, webUtils } from 'electron'

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
  selectAudio: () => ipcRenderer.invoke('files:audio'),
  selectAudioFiles: () => ipcRenderer.invoke('files:audios'),
  audioFilesFromDrop: async (files: File[]) => {
    const results = await Promise.allSettled(files.map(async file => ipcRenderer.invoke('files:audio-append', webUtils.getPathForFile(file))))
    return {
      files: results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []),
      errors: results.flatMap((result, index) => result.status === 'rejected' ? [`${files[index].name}: ${String(result.reason?.message || result.reason)}`] : [])
    }
  },
  audioFromDrop: (file: File) => ipcRenderer.invoke('files:audio-drop', webUtils.getPathForFile(file)),
  importText: () => ipcRenderer.invoke('files:import-text'),
  saveText: (input: { name: string; text: string }) => ipcRenderer.invoke('files:save-text', input),
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
