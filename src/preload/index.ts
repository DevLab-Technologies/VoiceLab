import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getBackendPort: (): Promise<number> => ipcRenderer.invoke('get-backend-port'),
  showSaveDialog: (options: Electron.SaveDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: Electron.OpenDialogOptions): Promise<string[]> =>
    ipcRenderer.invoke('show-open-dialog', options),
  getUserDataPath: (): Promise<string> => ipcRenderer.invoke('get-user-data-path'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (data: any) => void): (() => void) => {
    const handler = (_event: any, data: any): void => callback(data)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
  onBackendStatus: (callback: (data: { stage: string; message: string }) => void): (() => void) => {
    const handler = (_: any, data: { stage: string; message: string }): void => callback(data)
    ipcRenderer.on('backend-status', handler)
    return () => ipcRenderer.removeListener('backend-status', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
