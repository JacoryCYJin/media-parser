import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import {
  getMediaCoreStatus,
  healthMediaCore,
  parsePodcast,
  parseVideo,
  requestMediaCore,
  startMediaCore,
  stopMediaCore
} from './services/mediaCoreService'

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
