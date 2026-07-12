import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
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

const RELEASES_URL = 'https://github.com/JacoryCYJin/media-parser/releases'
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
    backgroundColor: '#f6f8fa',
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
    window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.info(`[renderer:${level}] ${message} (${sourceId}:${line})`)
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
    return {
      ok: false,
      status: 'failed',
      message: error instanceof Error ? error.message : String(error)
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
