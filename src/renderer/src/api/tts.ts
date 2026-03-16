import type { GenerateRequest, Generation } from '../types/tts'
import { apiClient } from './client'

export async function generateSpeech(
  request: GenerateRequest,
  signal?: AbortSignal
): Promise<Generation> {
  const res = await apiClient.post('/tts/generate', request, { signal })
  return res.data
}

export async function fetchGenerations(): Promise<Generation[]> {
  const res = await apiClient.get('/tts/generations')
  return res.data
}

export async function deleteGeneration(id: string): Promise<void> {
  await apiClient.delete(`/tts/generations/${id}`)
}

export async function cancelGeneration(): Promise<void> {
  await apiClient.post('/tts/cancel')
}
