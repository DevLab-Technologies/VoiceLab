import { ElectronAPI } from '@electron-toolkit/preload'

interface CustomAPI {
  getBackendPort: () => Promise<number>
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<string | null>
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<string[]>
  getUserDataPath: () => Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
