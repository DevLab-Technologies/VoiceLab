import type { DialectCode } from './dialect'
import type { ModelId } from './model'

export interface GenerateRequest {
  profile_id: string
  text: string
  dialect?: DialectCode
}

export interface Generation {
  id: string
  profile_id: string
  profile_name: string
  text: string
  dialect?: DialectCode
  language?: string
  model?: ModelId
  audio_path: string
  duration: number
  created_at: string
}
