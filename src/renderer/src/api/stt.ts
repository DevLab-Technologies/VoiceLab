import { apiClient } from './client'

export interface STTModelInfo {
  id: string
  name: string
  label: string
  size_mb: number
  description: string
  status: 'not_downloaded' | 'downloaded' | 'loaded'
}

export interface Transcription {
  id: string
  text: string
  model: string
  duration: number
  elapsed_seconds: number
  created_at: string
}

export async function transcribeAudio(
  audio: Blob,
  model?: string,
  language?: string,
  signal?: AbortSignal,
  save?: boolean
): Promise<Transcription & { text: string; model: string }> {
  const formData = new FormData()
  formData.append('audio', audio, 'audio.wav')
  if (model) formData.append('model', model)
  if (language) formData.append('language', language)
  formData.append('save', save ? 'true' : 'false')

  const res = await apiClient.post('/stt/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
    signal
  })
  return res.data
}

export async function fetchSTTModels(): Promise<STTModelInfo[]> {
  const res = await apiClient.get('/stt/models')
  return res.data
}

export async function downloadSTTModel(modelId: string): Promise<{ status: string }> {
  const res = await apiClient.post(`/stt/models/${modelId}/download`, {}, { timeout: 0 })
  return res.data
}

export async function deleteSTTModel(modelId: string): Promise<{ status: string }> {
  const res = await apiClient.delete(`/stt/models/${modelId}`)
  return res.data
}

export async function fetchTranscriptions(): Promise<Transcription[]> {
  const res = await apiClient.get('/stt/transcriptions')
  return res.data
}

export async function deleteTranscription(id: string): Promise<void> {
  await apiClient.delete(`/stt/transcriptions/${id}`)
}
