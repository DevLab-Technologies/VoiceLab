import { ElectronAPI } from '@electron-toolkit/preload'

interface CustomAPI {
  getBackendPort: () => Promise<number>
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<string | null>
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<string[]>
  getUserDataPath: () => Promise<string>
  getAppVersion: () => Promise<string>
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => Promise<void>
  onUpdateStatus: (callback: (data: any) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
