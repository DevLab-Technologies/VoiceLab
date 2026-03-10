import axios from 'axios'
import type { GenerateRequest, Generation } from '../types/tts'
import { getBaseURL } from './client'

function getClient() {
  return axios.create({ baseURL: `${getBaseURL()}/api`, timeout: 120000 })
}

export async function generateSpeech(request: GenerateRequest): Promise<Generation> {
  const res = await getClient().post('/tts/generate', request)
  return res.data
}

export async function fetchGenerations(): Promise<Generation[]> {
  const res = await getClient().get('/tts/generations')
  return res.data
}

export async function deleteGeneration(id: string): Promise<void> {
  await getClient().delete(`/tts/generations/${id}`)
}
