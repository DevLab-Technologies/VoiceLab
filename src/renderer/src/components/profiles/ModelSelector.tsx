import { Globe, Languages, Wand2, Users } from 'lucide-react'
import type { ModelId, ModelInfo } from '../../types/model'
import { MODEL_INFO } from '../../lib/constants'
import { cn } from '../../lib/utils'

interface ModelSelectorProps {
  value: ModelId
  onChange: (model: ModelId) => void
  availableModels: ModelInfo[]
}

const MODEL_ICONS: Record<ModelId, typeof Globe> = {
  'habibi-tts': Languages,
  'qwen3-tts': Globe,
  'qwen3-tts-voice-design': Wand2,
  'qwen3-tts-custom-voice': Users
}

export default function ModelSelector({ value, onChange, availableModels }: ModelSelectorProps) {
  const modelIds: ModelId[] = ['habibi-tts', 'qwen3-tts']

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-3">TTS Model</label>
      <div className="grid grid-cols-2 gap-3">
        {modelIds.map((id) => {
          const info = MODEL_INFO[id]
          const Icon = MODEL_ICONS[id]
          const modelState = availableModels.find((m) => m.id === id)
          const isAvailable = modelState && (modelState.status === 'downloaded' || modelState.status === 'loaded')
          const isSelected = value === id

          return (
            <button
              key={id}
              type="button"
              onClick={() => isAvailable && onChange(id)}
              disabled={!isAvailable}
              className={cn(
                'relative flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left',
                isSelected
                  ? 'border-accent bg-accent/10'
                  : isAvailable
                    ? 'border-white/10 bg-surface-200 hover:border-white/20'
                    : 'border-white/5 bg-surface-200/50 opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isSelected ? 'bg-accent/20' : 'bg-surface-300'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isSelected ? 'text-accent-light' : 'text-gray-400')} />
                </div>
                <div>
                  <p className={cn('text-sm font-medium', isSelected ? 'text-white' : 'text-gray-300')}>
                    {info.name}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                {info.languages.join(', ')}
              </p>
              {!isAvailable && (
                <span className="text-[10px] text-warning mt-2">
                  Download in Settings
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
