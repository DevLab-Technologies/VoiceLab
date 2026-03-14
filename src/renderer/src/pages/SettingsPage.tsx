import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FolderOpen, Trash2, Bug, AudioLines, Download, RefreshCw, Loader2, CheckCircle, ArrowDownToLine } from 'lucide-react'
import Header from '../components/layout/Header'
import Dialog from '../components/ui/Dialog'
import { useAppStore } from '../store'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error'

export default function SettingsPage() {
  const navigate = useNavigate()
  const {
    addToast,
    backendReady,
    sttModel,
    setSttModel,
    sttModels,
    fetchSttModels,
    devMode,
    setDevMode
  } = useAppStore()

  const [dataPath, setDataPath] = useState('')
  const [appVersion, setAppVersion] = useState('1.0.0')
  const [showClear, setShowClear] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateError, setUpdateError] = useState('')

  useEffect(() => {
    window.api.getUserDataPath().then((p) => setDataPath(p))
    window.api.getAppVersion().then((v) => setAppVersion(v))
    fetchSttModels()

    const cleanup = window.api.onUpdateStatus((data) => {
      setUpdateStatus(data.status)
      if (data.version) setUpdateVersion(data.version)
      if (data.percent !== undefined) setUpdateProgress(data.percent)
      if (data.message) setUpdateError(data.message)
    })

    return cleanup
  }, [fetchSttModels])

  const isModelDownloaded = (modelId: string) => {
    const model = sttModels.find((m) => m.id === modelId)
    return model ? model.status === 'downloaded' || model.status === 'loaded' : false
  }

  const handleClearData = () => {
    addToast('Cache cleared', 'success')
    setShowClear(false)
  }

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking')
    setUpdateError('')
    const result = await window.api.checkForUpdates()
    if (!result.success) {
      setUpdateStatus('error')
      setUpdateError(result.error || 'Failed to check for updates')
    }
  }

  const handleDownloadUpdate = async () => {
    setUpdateProgress(0)
    const result = await window.api.downloadUpdate()
    if (!result.success) {
      setUpdateStatus('error')
      setUpdateError(result.error || 'Download failed')
    }
  }

  const handleInstallUpdate = () => {
    window.api.installUpdate()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header title="Settings" />

      <div className="max-w-xl space-y-6">
        {/* System Status */}
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

        {/* Updates */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Updates
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-400">Current Version</span>
              <p className="text-xs text-gray-600 mt-0.5">v{appVersion}</p>
            </div>
            <div className="flex items-center gap-2">
              {updateStatus === 'idle' && (
                <button
                  onClick={handleCheckForUpdates}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs font-medium rounded-lg hover:bg-accent/20 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Check for Updates
                </button>
              )}
              {updateStatus === 'checking' && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Checking...
                </span>
              )}
              {updateStatus === 'up-to-date' && (
                <span className="flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Up to date
                </span>
              )}
              {updateStatus === 'available' && (
                <button
                  onClick={handleDownloadUpdate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs font-medium rounded-lg hover:bg-accent/20 transition-colors"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Download v{updateVersion}
                </button>
              )}
              {updateStatus === 'downloading' && (
                <span className="flex items-center gap-1.5 text-xs text-accent">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Downloading... {updateProgress}%
                </span>
              )}
              {updateStatus === 'downloaded' && (
                <button
                  onClick={handleInstallUpdate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success text-xs font-medium rounded-lg hover:bg-success/20 transition-colors"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Install & Restart
                </button>
              )}
              {updateStatus === 'error' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-danger truncate max-w-[180px]">{updateError}</span>
                  <button
                    onClick={handleCheckForUpdates}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Speech to Text — Default Model */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <AudioLines className="w-4 h-4" />
            Default STT Model
          </h3>
          <p className="text-xs text-gray-500">
            Select the Whisper model used for transcription. Download models from the Models page.
          </p>
          <div className="space-y-2">
            {[
              { id: 'openai/whisper-tiny', name: 'Tiny', size: '~150 MB', desc: 'Very fast, basic quality' },
              { id: 'openai/whisper-base', name: 'Base', size: '~290 MB', desc: 'Fast, good quality' },
              { id: 'openai/whisper-small', name: 'Small', size: '~960 MB', desc: 'Balanced speed & quality' },
              { id: 'openai/whisper-large-v3-turbo', name: 'Large V3 Turbo', size: '~1.5 GB', desc: 'Best accuracy' }
            ].map((m) => {
              const downloaded = isModelDownloaded(m.id)
              const selected = sttModel === m.id

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
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    !downloaded
                      ? 'border-white/5 bg-surface-200 opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-accent/40 bg-accent/5'
                        : 'border-white/5 bg-surface-200 hover:bg-surface-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">{m.name}</span>
                    {!downloaded ? (
                      <Download className="w-3 h-3 text-gray-500" />
                    ) : (
                      <span className="text-[10px] text-gray-500">{m.size}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {!downloaded ? 'Not downloaded' : m.desc}
                  </p>
                </button>
              )
            })}
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

        {/* Developer */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Developer
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-400">Developer Mode</span>
              <p className="text-xs text-gray-600 mt-0.5">
                Show debug data for each generation
              </p>
            </div>
            <button
              onClick={() => setDevMode(!devMode)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                devMode ? 'bg-accent' : 'bg-surface-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                  devMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* About */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">About</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex justify-between">
              <span>App Version</span>
              <span className="text-gray-500">v{appVersion}</span>
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
