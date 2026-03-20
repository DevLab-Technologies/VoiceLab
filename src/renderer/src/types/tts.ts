import type { DialectCode } from './dialect'
import type { ModelId } from './model'

export interface GenerateRequest {
  profile_id?: string
  text: string
  dialect?: DialectCode
  speed?: number
  nfe_step?: number
  cfg_strength?: number
  model?: ModelId
  instruct?: string
  language?: string
  speaker?: string
}

export interface Generation {
  id: string
  profile_id?: string
  profile_name?: string
  text: string
  dialect?: DialectCode
  language?: string
  model?: ModelId
  instruct?: string
  speaker?: string
  audio_path: string
  duration: number
  elapsed_seconds?: number
  created_at: string
}
