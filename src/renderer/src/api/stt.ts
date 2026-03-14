import axios from 'axios'
import { getBaseURL } from './client'

function getClient() {
  return axios.create({ baseURL: `${getBaseURL()}/api`, timeout: 300000 })
}

export interface STTModelInfo {
  id: string
  name: string
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

  const res = await getClient().post('/stt/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal
  })
  return res.data
}

export async function fetchSTTModels(): Promise<STTModelInfo[]> {
  const res = await getClient().get('/stt/models')
  return res.data
}

export async function downloadSTTModel(modelId: string): Promise<{ status: string }> {
  const res = await getClient().post(`/stt/models/${modelId}/download`)
  return res.data
}

export async function deleteSTTModel(modelId: string): Promise<{ status: string }> {
  const res = await getClient().delete(`/stt/models/${modelId}`)
  return res.data
}

export async function fetchTranscriptions(): Promise<Transcription[]> {
  const res = await getClient().get('/stt/transcriptions')
  return res.data
}

export async function deleteTranscription(id: string): Promise<void> {
  await getClient().delete(`/stt/transcriptions/${id}`)
}
