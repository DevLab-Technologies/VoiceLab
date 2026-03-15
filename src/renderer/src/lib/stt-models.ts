import type { STTModelInfo } from '../api/stt'

/**
 * Derive a model-id → display-name map from the backend STT models list.
 * The backend is the single source of truth for model metadata.
 */
export function sttModelName(models: STTModelInfo[], modelId: string): string {
  return models.find((m) => m.id === modelId)?.name || modelId
}
