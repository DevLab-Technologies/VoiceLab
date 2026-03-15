export interface STTModelDef {
  id: string
  name: string
  label: string
  size: string
  size_mb: number
  description: string
}

export const STT_MODELS: STTModelDef[] = [
  {
    id: 'openai/whisper-tiny',
    name: 'Whisper Tiny',
    label: 'Tiny (~150 MB)',
    size: '~150 MB',
    size_mb: 150,
    description: 'Very fast, basic quality — good for quick drafts or limited RAM'
  },
  {
    id: 'openai/whisper-base',
    name: 'Whisper Base',
    label: 'Base (~290 MB)',
    size: '~290 MB',
    size_mb: 290,
    description: 'Fast with good quality — recommended for low-resource machines'
  },
  {
    id: 'openai/whisper-small',
    name: 'Whisper Small',
    label: 'Small (~960 MB)',
    size: '~960 MB',
    size_mb: 960,
    description: 'Balanced speed and quality'
  },
  {
    id: 'openai/whisper-large-v3-turbo',
    name: 'Whisper Large V3 Turbo',
    label: 'Large V3 Turbo (~1.5 GB)',
    size: '~1.5 GB',
    size_mb: 1500,
    description: 'Best accuracy, requires more memory'
  }
]

export const STT_MODEL_NAMES: Record<string, string> = Object.fromEntries(
  STT_MODELS.map((m) => [m.id, m.name])
)
