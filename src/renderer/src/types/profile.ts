import type { DialectCode } from './dialect'
import type { ModelId } from './model'

export interface Profile {
  id: string
  name: string
  model: ModelId
  dialect?: DialectCode
  language?: string
  ref_text: string
  ref_audio_path: string
  ref_audio_duration: number
  created_at: string
  updated_at: string
}

export interface CreateProfilePayload {
  name: string
  model: ModelId
  dialect?: DialectCode
  language?: string
  ref_text: string
  ref_audio: File | Blob
}
