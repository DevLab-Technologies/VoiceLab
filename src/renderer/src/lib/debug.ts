import type { Generation } from '../types/tts'
import type { Profile } from '../types/profile'

interface AppInfo {
  version: string
  backendReady: boolean
}

export function buildDebugData(
  generation: Generation,
  profile: Profile | undefined,
  app: AppInfo
): Record<string, unknown> {
  return {
    generation_id: generation.id,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          model: profile.model || 'habibi-tts',
          dialect: profile.dialect || null,
          language: profile.language || null,
          ref_text: profile.ref_text,
          ref_audio_duration: profile.ref_audio_duration
        }
      : { id: generation.profile_id, name: generation.profile_name },
    input: {
      text: generation.text,
      text_length: generation.text.length
    },
    output: {
      duration: generation.duration,
      elapsed_seconds: generation.elapsed_seconds || 0,
      audio_path: generation.audio_path,
      model: generation.model || 'habibi-tts',
      dialect: generation.dialect || null,
      language: generation.language || null
    },
    app: {
      version: app.version || '1.0.0',
      backend_ready: app.backendReady,
      platform: navigator.platform
    },
    created_at: generation.created_at
  }
}
