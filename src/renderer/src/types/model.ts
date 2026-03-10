export type ModelId = 'habibi-tts' | 'qwen3-tts'

export type ModelStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'loading' | 'loaded' | 'error'

export interface ModelInfo {
  id: ModelId
  name: string
  description: string
  languages: string[]
  size_mb: number
  status: ModelStatus
  download_progress?: number
  error?: string
}
