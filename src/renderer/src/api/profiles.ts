import type { Profile } from '../types/profile'
import type { DialectCode } from '../types/dialect'
import type { ModelId } from '../types/model'
import { apiClient } from './client'

export async function fetchProfiles(): Promise<Profile[]> {
  const res = await apiClient.get('/profiles')
  return res.data
}

export async function fetchProfile(id: string): Promise<Profile> {
  const res = await apiClient.get(`/profiles/${id}`)
  return res.data
}

export async function createProfile(
  name: string,
  model: ModelId,
  dialect: DialectCode | undefined,
  language: string | undefined,
  refText: string,
  audioBlob: Blob,
  audioFilename: string
): Promise<Profile> {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('model', model)
  if (dialect) formData.append('dialect', dialect)
  if (language) formData.append('language', language)
  formData.append('ref_text', refText)
  formData.append('ref_audio', audioBlob, audioFilename)

  const res = await apiClient.post('/profiles', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000
  })
  return res.data
}

export async function updateProfile(
  id: string,
  data: { name?: string; model?: ModelId; dialect?: DialectCode; language?: string; ref_text?: string }
): Promise<Profile> {
  const res = await apiClient.put(`/profiles/${id}`, data)
  return res.data
}

export async function deleteProfile(id: string): Promise<void> {
  await apiClient.delete(`/profiles/${id}`)
}
