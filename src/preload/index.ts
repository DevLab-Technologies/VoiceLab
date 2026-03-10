import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getBackendPort: (): Promise<number> => ipcRenderer.invoke('get-backend-port'),
  showSaveDialog: (options: Electron.SaveDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: Electron.OpenDialogOptions): Promise<string[]> =>
    ipcRenderer.invoke('show-open-dialog', options),
  getUserDataPath: (): Promise<string> => ipcRenderer.invoke('get-user-data-path')
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
