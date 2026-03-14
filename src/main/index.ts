import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { startPythonBackend, stopPythonBackend, getBackendPort } from './python'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f1117',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Auto-Updater ──────────────────────────────────────────────────────
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

function sendUpdateStatus(status: string, info?: Record<string, unknown>): void {
  mainWindow?.webContents.send('update-status', { status, ...info })
}

autoUpdater.on('checking-for-update', () => {
  sendUpdateStatus('checking')
})

autoUpdater.on('update-available', (info) => {
  sendUpdateStatus('available', { version: info.version })
})

autoUpdater.on('update-not-available', () => {
  sendUpdateStatus('up-to-date')
})

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus('downloading', { percent: Math.round(progress.percent) })
})

autoUpdater.on('update-downloaded', (info) => {
  sendUpdateStatus('downloaded', { version: info.version })
})

autoUpdater.on('error', (err) => {
  sendUpdateStatus('error', { message: err.message })
})

// ── IPC Handlers ──────────────────────────────────────────────────────
ipcMain.handle('get-backend-port', () => getBackendPort())

ipcMain.handle('show-save-dialog', async (_, options) => {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result.canceled ? null : result.filePath
})

ipcMain.handle('show-open-dialog', async (_, options) => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('get-user-data-path', () => app.getPath('userData'))

ipcMain.handle('get-app-version', () => app.getVersion())

ipcMain.handle('check-for-updates', async () => {
  try {
    await autoUpdater.checkForUpdates()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})

// Set the app name for the Mac menu bar (shows "VoiceLab" instead of "Electron" in dev)
if (process.platform === 'darwin') {
  app.setName('VoiceLab')
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.voicelab.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    await startPythonBackend()
  } catch (err) {
    console.error('Failed to start Python backend:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopPythonBackend()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
