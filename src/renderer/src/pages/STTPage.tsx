import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AudioLines, Loader2, Copy, Check, Download, X, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import Header from '../components/layout/Header'
import AudioRecorder from '../components/audio/AudioRecorder'
import AudioImporter from '../components/audio/AudioImporter'
import { useAppStore } from '../store'

export default function STTPage() {
  const navigate = useNavigate()
  const {
    addToast,
    sttModel, setSttModel,
    sttModels, fetchSttModels,
    sttTranscribing, sttResult, setSttResult,
    sttAudioBlob, sttAudioSource, setSttAudioSource,
    setSttAudioBlob, transcribe, stopTranscription, clearSttSession
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
          <div className="grid grid-cols-2 gap-2">
            {sttModels.map((m) => {
              const downloaded = m.status === 'downloaded' || m.status === 'loaded'
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
                  className={`text-left p-3 rounded-xl border transition-all ${
                    !downloaded
                      ? 'border-white/5 bg-surface-200 opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-accent/40 bg-accent/5'
                        : 'border-white/5 bg-surface-200 hover:bg-surface-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">{m.label}</span>
                    {!downloaded && <Download className="w-3 h-3 text-gray-500" />}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {!downloaded ? 'Not downloaded' : m.description}
                  </p>
                </button>
              )
            })}
          </div>
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
          </div>

          {sttAudioSource === 'record' ? (
            <AudioRecorder onRecorded={handleRecorded} />
          ) : (
            <AudioImporter onImported={handleImport} />
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
