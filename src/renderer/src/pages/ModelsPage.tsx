import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Languages,
  Globe,
  AudioLines
} from 'lucide-react'
import Header from '../components/layout/Header'
import { useAppStore } from '../store'
import { MODEL_INFO } from '../lib/constants'
import { STT_MODELS } from '../lib/stt-models'
import type { ModelId } from '../types/model'
import type { STTModelInfo } from '../api/stt'

const MODEL_ICONS: Record<ModelId, typeof Globe> = {
  'habibi-tts': Languages,
  'qwen3-tts': Globe
}

export default function ModelsPage() {
  const {
    addToast,
    availableModels,
    fetchModels,
    downloadModel,
    deleteModel,
    sttModels,
    fetchSttModels,
    downloadSttModel,
    deleteSttModel
  } = useAppStore()

  const [downloadingStt, setDownloadingStt] = useState<string | null>(null)

  useEffect(() => {
    fetchModels()
    fetchSttModels()
  }, [fetchModels, fetchSttModels])

  // Merge shared STT model definitions with backend status data
  const mergedSttModels: STTModelInfo[] = STT_MODELS.map((def) => {
    const backendModel = sttModels.find((m) => m.id === def.id)
    return backendModel || { ...def, status: 'not_downloaded' as const }
  })

  // Poll TTS model status every 3 seconds while any model is downloading
  useEffect(() => {
    const isDownloading = availableModels.some((m) => m.status === 'downloading')
    if (!isDownloading) return

    const interval = setInterval(fetchModels, 3000)
    return () => clearInterval(interval)
  }, [availableModels, fetchModels])

  const handleDownloadStt = async (modelId: string) => {
    setDownloadingStt(modelId)
    try {
      await downloadSttModel(modelId)
    } finally {
      setDownloadingStt(null)
    }
  }

  const modelIds: ModelId[] = ['habibi-tts', 'qwen3-tts']

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header title="Models" subtitle="Download and manage TTS and STT models" />

      <div className="max-w-xl space-y-8">
        {/* TTS Models */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Text-to-Speech
            </h2>
          </div>
          <p className="text-xs text-gray-500">
            Download models to use them for voice generation. Each profile uses one model.
          </p>
          <div className="space-y-3">
            {modelIds.map((id) => {
              const info = MODEL_INFO[id]
              const modelState = availableModels.find((m) => m.id === id)
              const status = modelState?.status || 'not_downloaded'
              const progress = modelState?.download_progress || 0
              const Icon = MODEL_ICONS[id]

              return (
                <div key={id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-300 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white">{info.name}</h4>
                        <span className="text-[10px] text-gray-500">
                          {info.sizeMB >= 1000
                            ? `${(info.sizeMB / 1000).toFixed(1)} GB`
                            : `${info.sizeMB} MB`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {info.languages.join(', ')}
                      </p>

                      {/* Status & Actions */}
                      <div className="mt-3 flex items-center gap-2">
                        {status === 'not_downloaded' && (
                          <button
                            onClick={() => downloadModel(id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs font-medium rounded-lg hover:bg-accent/20 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        )}

                        {status === 'downloading' && (
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                              <span className="text-xs text-accent">
                                Downloading... {progress}%
                              </span>
                            </div>
                            <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {(status === 'downloaded' || status === 'loaded') && (
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-success" />
                              <span className="text-xs text-success">
                                {status === 'loaded' ? 'Ready' : 'Downloaded'}
                              </span>
                            </div>
                            <div className="flex-1" />
                            <button
                              onClick={() => deleteModel(id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-danger transition-colors rounded"
                            >
                              <X className="w-3 h-3" />
                              Remove
                            </button>
                          </div>
                        )}

                        {status === 'error' && (
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-danger" />
                              <span className="text-xs text-danger truncate">
                                {modelState?.error || 'Download failed'}
                              </span>
                            </div>
                            <div className="flex-1" />
                            <button
                              onClick={() => downloadModel(id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs font-medium rounded-lg hover:bg-accent/20 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* STT Models */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <AudioLines className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Speech-to-Text
            </h2>
          </div>
          <p className="text-xs text-gray-500">
            Download Whisper models for audio transcription. Larger models are more accurate but
            use more memory.
          </p>
          <div className="space-y-3">
            {mergedSttModels.map((m) => {
              const isDownloading = downloadingStt === m.id

              return (
                <div key={m.id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-300 flex items-center justify-center shrink-0">
                      <AudioLines className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white">{m.name}</h4>
                        <span className="text-[10px] text-gray-500">
                          {m.size_mb >= 1000
                            ? `${(m.size_mb / 1000).toFixed(1)} GB`
                            : `${m.size_mb} MB`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>

                      {/* Status & Actions */}
                      <div className="mt-3 flex items-center gap-2">
                        {m.status === 'not_downloaded' && !isDownloading && (
                          <button
                            onClick={() => handleDownloadStt(m.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs font-medium rounded-lg hover:bg-accent/20 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        )}

                        {isDownloading && (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                            <span className="text-xs text-accent">Downloading...</span>
                          </div>
                        )}

                        {(m.status === 'downloaded' || m.status === 'loaded') && !isDownloading && (
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-success" />
                              <span className="text-xs text-success">
                                {m.status === 'loaded' ? 'Loaded' : 'Downloaded'}
                              </span>
                            </div>
                            <div className="flex-1" />
                            <button
                              onClick={() => deleteSttModel(m.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-danger transition-colors rounded"
                            >
                              <X className="w-3 h-3" />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </motion.div>
  )
}
