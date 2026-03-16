import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AudioLines, Loader2, Copy, Check, X, RotateCcw } from 'lucide-react'
import Header from '../components/layout/Header'
import AudioRecorder from '../components/audio/AudioRecorder'
import AudioImporter from '../components/audio/AudioImporter'
import YouTubeImporter from '../components/audio/YouTubeImporter'
import STTModelSelector from '../components/stt/STTModelSelector'
import { useAppStore } from '../store'

export default function STTPage() {
  const {
    addToast,
    sttModel,
    sttModels, fetchSttModels,
    sttTranscribing, sttResult, setSttResult,
    sttAudioBlob, sttAudioSource, setSttAudioSource,
    setSttAudioBlob, transcribe, stopTranscription, clearSttSession,
    ytUrl, ytState, ytInfo, ytError,
    setYtUrl, setYtState, setYtInfo, setYtError, resetYtState
  } = useAppStore()

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchSttModels()
  }, [fetchSttModels])

  const isSttModelReady = (modelId: string) => {
    const model = sttModels.find((m) => m.id === modelId)
    return model ? model.status === 'downloaded' || model.status === 'loaded' : false
  }

  const handleRecorded = (blob: Blob) => {
    setSttAudioBlob(blob, 'record')
  }

  const handleImport = (file: File) => {
    setSttAudioBlob(file, 'import')
  }

  const handleYouTubeExtracted = (blob: Blob) => {
    setSttAudioBlob(blob, 'youtube')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sttResult)
      setCopied(true)
      addToast('Copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('Failed to copy', 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header
        title="Transcribe"
        subtitle="Convert speech to text using Whisper"
      />

      <div className="max-w-2xl space-y-6">
        {/* Model Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Whisper Model
          </label>
          <STTModelSelector layout="grid" />
        </div>

        {/* Audio Source */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Audio Input</label>

          <div className="flex gap-1 bg-surface-200 p-1 rounded-lg mb-4 w-fit">
            <button
              onClick={() => setSttAudioSource('record')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                sttAudioSource === 'record' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Record
            </button>
            <button
              onClick={() => setSttAudioSource('import')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                sttAudioSource === 'import' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Import
            </button>
            <button
              onClick={() => setSttAudioSource('youtube')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                sttAudioSource === 'youtube' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              YouTube
            </button>
          </div>

          {sttAudioSource === 'record' ? (
            <AudioRecorder onRecorded={handleRecorded} />
          ) : sttAudioSource === 'import' ? (
            <AudioImporter onImported={handleImport} />
          ) : (
            <YouTubeImporter
              onExtracted={handleYouTubeExtracted}
              persistedState={{
                url: ytUrl,
                setUrl: setYtUrl,
                state: ytState,
                setState: setYtState,
                info: ytInfo,
                setInfo: setYtInfo,
                error: ytError,
                setError: setYtError,
                reset: resetYtState,
              }}
            />
          )}
        </div>

        {/* Transcribe / Cancel Button */}
        {sttTranscribing ? (
          <button
            onClick={stopTranscription}
            className="btn-danger w-full flex items-center justify-center gap-2 py-3 text-base"
          >
            <X className="w-5 h-5" />
            Cancel Transcription
          </button>
        ) : (
          <button
            onClick={transcribe}
            disabled={!sttAudioBlob || !isSttModelReady(sttModel)}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
          >
            <AudioLines className="w-5 h-5" />
            Transcribe
          </button>
        )}

        {/* Transcribing indicator (visible even if user navigated away and came back) */}
        {sttTranscribing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 py-4 text-accent"
          >
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Transcribing audio...</span>
          </motion.div>
        )}

        {/* Result */}
        {sttResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Transcription Result</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-surface-200"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-success" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={clearSttSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-surface-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  New
                </button>
              </div>
            </div>
            <textarea
              value={sttResult}
              onChange={(e) => setSttResult(e.target.value)}
              rows={6}
              dir="auto"
              className="input-field text-base leading-relaxed resize-none"
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
