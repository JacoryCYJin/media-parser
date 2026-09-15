import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join, extname, basename } from 'node:path'
import { stat, readFile, writeFile } from 'node:fs/promises'
import { autoUpdater } from 'electron-updater'
import {
  getMediaCoreStatus,
  healthMediaCore,
  parsePodcast,
  parseVideo,
  requestMediaCore,
  startMediaCore,
  stopMediaCore
} from './services/mediaCoreService'

const EXTERNAL_LINKS = {
  projectHome: 'https://jacoryspace.top/tools/media-parser',
  githubReleases: 'https://github.com/JacoryCYJin/media-parser/releases'
} as const

const RELEASES_URL = EXTERNAL_LINKS.githubReleases
let updateChecksConfigured = false

function setupUpdateChecks(): void {
  if (updateChecksConfigured) return
  updateChecksConfigured = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    const version = info.version ? `v${info.version}` : 'new version'
    void dialog.showMessageBox({
      type: 'info',
      buttons: ['Open Releases', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Media Parser Update',
      message: `Media Parser ${version} is available.`,
      detail: 'Open the GitHub Releases page to download the latest package.'
    }).then((result) => {
      if (result.response === 0) {
        void shell.openExternal(RELEASES_URL)
      }
    })
  })

  autoUpdater.on('error', (error) => {
    console.info(`[updater] ${error.message}`)
  })
}

function checkForUpdatesAfterLaunch(): void {
  if (!app.isPackaged) return

  setupUpdateChecks()
  setTimeout(() => {
    void autoUpdater.checkForUpdates()
  }, 3500)
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    title: 'Media Parser',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged) {
    window.webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
      console.info(`[renderer:${level}] ${message} (${sourceId}:${lineNumber})`)
    })

    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

ipcMain.handle('app:health', () => ({
  ok: true,
  service: 'media-parser-desktop',
  runtime: 'electron-main',
  timestamp: new Date().toISOString()
}))

ipcMain.handle('app:open-external', async (_event, target: keyof typeof EXTERNAL_LINKS) => {
  const url = EXTERNAL_LINKS[target]
  if (!url) {
    return {
      ok: false,
      status: 'unknown-target'
    }
  }

  await shell.openExternal(url)
  return {
    ok: true,
    status: 'opened'
  }
})

ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) {
    return {
      ok: false,
      status: 'development',
      message: 'Update checks are only available in packaged builds.'
    }
  }

  setupUpdateChecks()

  try {
    await autoUpdater.checkForUpdates()
    return {
      ok: true,
      status: 'checking',
      message: 'Checking for updates.'
    }
  } catch (error) {
    console.info(`[updater] ${error instanceof Error ? error.message : String(error)}`)
    return {
      ok: false,
      status: 'failed',
      message: 'Update check failed.'
    }
  }
})

ipcMain.handle('media-core:status', () => getMediaCoreStatus())
ipcMain.handle('media-core:start', () => startMediaCore())
ipcMain.handle('media-core:stop', () => stopMediaCore())
ipcMain.handle('media-core:health', () => healthMediaCore())
ipcMain.handle('media-core:request', (_event, request) => requestMediaCore(request))
ipcMain.handle('media:parse-video', (_event, url: string) => parseVideo(url))
ipcMain.handle('media:parse-podcast', (_event, url: string) => parsePodcast(url))

ipcMain.handle('dialog:select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })

  return {
    canceled: result.canceled,
    path: result.filePaths[0] ?? ''
  }
})

app.whenReady().then(() => {
  createMainWindow()
  checkForUpdatesAfterLaunch()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopMediaCore()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopMediaCore()
})

const handleProcessShutdown = () => {
  stopMediaCore()
  app.quit()
}

process.once('SIGINT', handleProcessShutdown)
process.once('SIGTERM', handleProcessShutdown)

const audioExtensions = new Set(['.mp3', '.m4a', '.wav', '.flac', '.ogg', '.aac'])
async function describeAudio(path: string) {
  if (typeof path !== 'string' || !audioExtensions.has(extname(path).toLowerCase())) throw new Error('请选择音频文件 / Select an audio file')
  const info = await stat(path)
  if (!info.isFile() || info.size > 300 * 1024 * 1024) throw new Error('音频文件无效或超过 300 MB / Invalid audio file or exceeds 300 MB')
  return { path, name: basename(path), size: info.size }
}
ipcMain.handle('files:audio', async () => {
  const choice = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Audio', extensions: [...audioExtensions].map(x => x.slice(1)) }] })
  if (choice.canceled) return null
  return describeAudio(choice.filePaths[0])
})
ipcMain.handle('files:audio-drop', (_event, path: string) => describeAudio(path))
ipcMain.handle('files:import-text', async () => {
  const choice = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Text', extensions: ['txt', 'md', 'srt'] }] })
  if (choice.canceled) return null
  const path = choice.filePaths[0]
  const info = await stat(path)
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('文本文件不能超过 2 MB / Text file must be under 2 MB')
  return { name: basename(path), text: await readFile(path, 'utf8') }
})
ipcMain.handle('files:save-text', async (_event, input: { name: string; text: string }) => {
  if (!input || typeof input.text !== 'string' || input.text.length > 5_000_000) throw new Error('无效文本 / Invalid text')
  const choice = await dialog.showSaveDialog({ defaultPath: basename(input.name || 'transcript.txt'), filters: [{ name: 'Text', extensions: ['txt', 'md', 'srt'] }] })
  if (choice.canceled || !choice.filePath) return null
  await writeFile(choice.filePath, input.text, 'utf8')
  return { path: choice.filePath }
})
