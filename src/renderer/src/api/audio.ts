import axios from 'axios'
import { getBaseURL } from './client'

function getClient() {
  return axios.create({ baseURL: `${getBaseURL()}/api`, timeout: 30000 })
}

export function getProfileAudioUrl(profileId: string): string {
  return `${getBaseURL()}/api/audio/profiles/${profileId}/ref_audio.wav`
}

export function getGenerationAudioUrl(generationId: string): string {
  return `${getBaseURL()}/api/audio/generations/${generationId}/output.wav`
}

export function getTranscriptionAudioUrl(transcriptionId: string): string {
  return `${getBaseURL()}/api/audio/transcriptions/${transcriptionId}/source_audio.wav`
}

export async function fetchWaveform(
  type: 'profiles' | 'generations' | 'transcriptions',
  id: string,
  filename: string
): Promise<{ waveform: number[]; duration: number }> {
  const res = await getClient().get(`/audio/waveform/${type}/${id}/${filename}`)
  return res.data
}

export async function checkHealth(): Promise<{
  status: string
  model_loaded: boolean
  model_status: string
}> {
  const res = await getClient().get('/health')
  return res.data
}
