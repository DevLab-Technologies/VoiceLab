import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FolderOpen, Trash2, Download, X, Loader2, CheckCircle, AlertCircle, Languages, Globe } from 'lucide-react'
import Header from '../components/layout/Header'
import Dialog from '../components/ui/Dialog'
import { useAppStore } from '../store'
import { MODEL_INFO } from '../lib/constants'
import type { ModelId } from '../types/model'

const MODEL_ICONS: Record<ModelId, typeof Globe> = {
  'habibi-tts': Languages,
  'qwen3-tts': Globe
}

export default function SettingsPage() {
  const {
    addToast,
    backendReady,
    availableModels,
    fetchModels,
    downloadModel,
    deleteModel
  } = useAppStore()

  const [dataPath, setDataPath] = useState('')
  const [showClear, setShowClear] = useState(false)

  useEffect(() => {
    window.api.getUserDataPath().then((p) => setDataPath(p))
    fetchModels()
  }, [])

  // Poll model status every 3 seconds while any model is downloading
  useEffect(() => {
    const isDownloading = availableModels.some((m) => m.status === 'downloading')
    if (!isDownloading) return

    const interval = setInterval(fetchModels, 3000)
    return () => clearInterval(interval)
  }, [availableModels, fetchModels])

  const handleClearData = () => {
    addToast('Cache cleared', 'success')
    setShowClear(false)
  }

  const modelIds: ModelId[] = ['habibi-tts', 'qwen3-tts']

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header title="Settings" />

      <div className="max-w-xl space-y-6">
        {/* Models */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">TTS Models</h3>
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
                <div key={id} className="bg-surface-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-300 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white">{info.name}</h4>
                        <span className="text-[10px] text-gray-500">
                          {info.sizeMB >= 1000 ? `${(info.sizeMB / 1000).toFixed(1)} GB` : `${info.sizeMB} MB`}
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
                              <span className="text-xs text-accent">Downloading... {progress}%</span>
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
        </div>

        {/* Status */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Backend Server</span>
              <span className={`badge ${backendReady ? 'badge-success' : 'bg-danger/15 text-danger'}`}>
                {backendReady ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Storage</h3>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span className="truncate font-mono text-xs">{dataPath}</span>
          </div>
          <button
            onClick={() => setShowClear(true)}
            className="btn-danger flex items-center gap-2 text-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Generated Audio Cache
          </button>
        </div>

        {/* About */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">About</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex justify-between">
              <span>App Version</span>
              <span className="text-gray-500">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>TTS Engines</span>
              <span className="text-gray-500">HabibiTTS, Qwen3-TTS</span>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={showClear}
        onClose={() => setShowClear(false)}
        title="Clear Cache"
        actions={
          <>
            <button onClick={() => setShowClear(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleClearData} className="btn-danger">Clear</button>
          </>
        }
      >
        <p>This will remove all generated audio files. Profiles will be preserved.</p>
      </Dialog>
    </motion.div>
  )
}
