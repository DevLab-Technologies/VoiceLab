import { Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import type { STTModelInfo } from '../../api/stt'

interface STTModelSelectorProps {
  layout?: 'grid' | 'list'
}

export default function STTModelSelector({ layout = 'grid' }: STTModelSelectorProps) {
  const navigate = useNavigate()
  const { addToast, sttModel, setSttModel, sttModels } = useAppStore()

  const containerClass = layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'

  return (
    <div className={containerClass}>
      {sttModels.map((m: STTModelInfo) => {
        const downloaded = m.status === 'downloaded' || m.status === 'loaded'
        const selected = sttModel === m.id
        const sizeLabel = m.size_mb >= 1000
          ? `~${(m.size_mb / 1000).toFixed(1)} GB`
          : `~${m.size_mb} MB`

        return (
          <button
            key={m.id}
            onClick={() => {
              if (downloaded) {
                setSttModel(m.id)
              } else {
                navigate('/models')
                addToast('Download the model first from the Models page', 'info')
              }
            }}
            className={`${layout === 'list' ? 'w-full ' : ''}text-left p-3 rounded-xl border transition-all ${
              !downloaded
                ? 'border-white/5 bg-surface-200 opacity-50 cursor-not-allowed'
                : selected
                  ? 'border-accent/40 bg-accent/5'
                  : 'border-white/5 bg-surface-200 hover:bg-surface-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">{m.label}</span>
              {!downloaded ? (
                <Download className="w-3 h-3 text-gray-500" />
              ) : layout === 'list' ? (
                <span className="text-[10px] text-gray-500">{sizeLabel}</span>
              ) : null}
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {!downloaded ? 'Not downloaded' : m.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}
