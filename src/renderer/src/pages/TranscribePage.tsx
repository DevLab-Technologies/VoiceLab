import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { FileAudio, Upload, Loader2, Copy, Check } from 'lucide-react'
import Header from '../components/layout/Header'
import AudioRecorder from '../components/audio/AudioRecorder'
import YouTubeImporter from '../components/audio/YouTubeImporter'
import { transcribeAudio } from '../api/stt'
import { useAppStore } from '../store'

type Tab = 'record' | 'import' | 'youtube'

const WHISPER_MODELS = [
  { id: 'tiny', label: 'Tiny', desc: 'Fastest, least accurate' },
  { id: 'base', label: 'Base', desc: 'Good balance' },
  { id: 'small', label: 'Small', desc: 'Better accuracy' },
  { id: 'medium', label: 'Medium', desc: 'High accuracy' },
  { id: 'large', label: 'Large', desc: 'Best accuracy, slowest' },
]

export default function TranscribePage() {
  const { addToast } = useAppStore()
  const [tab, setTab] = useState<Tab>('youtube')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioName, setAudioName] = useState('')
  const [whisperModel, setWhisperModel] = useState('base')
  const [language, setLanguage] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRecorded = (blob: Blob) => {
    setAudioBlob(blob)
    setAudioName('recording.webm')
  }

  const handleImport = (file: File) => {
    setAudioBlob(file)
    setAudioName(file.name)
  }

  const handleYouTubeExtracted = (blob: Blob, meta: { title: string }) => {
    setAudioBlob(blob)
    setAudioName(meta.title + '.wav')
  }

  const handleTranscribe = async () => {
    if (!audioBlob) return
    setTranscribing(true)
    setResult('')
    try {
      const res = await transcribeAudio(
        audioBlob,
        audioName || 'audio.wav',
        language || undefined,
        whisperModel
      )
      setResult(res.text)
    } catch (err: any) {
      addToast(err?.response?.data?.detail || 'Transcription failed', 'error')
    } finally {
      setTranscribing(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header title="Transcribe" />

      <div className="max-w-xl space-y-6">
        {/* Audio Source Tabs */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Audio Source</label>
          <div className="flex gap-1 bg-surface-200 p-1 rounded-lg mb-4 w-fit">
            <button
              onClick={() => setTab('record')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === 'record' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Record
            </button>
            <button
              onClick={() => setTab('youtube')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === 'youtube' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              YouTube
            </button>
            <button
              onClick={() => setTab('import')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === 'import' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Import
            </button>
          </div>

          {tab === 'record' ? (
            <AudioRecorder onRecorded={handleRecorded} />
          ) : tab === 'youtube' ? (
            <YouTubeImporter onExtracted={handleYouTubeExtracted} />
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="glass-card-hover p-4 flex items-center gap-3 cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImport(file)
                }}
              />
              {audioName && tab === 'import' ? (
                <>
                  <FileAudio className="w-5 h-5 text-accent shrink-0" />
                  <p className="text-sm text-gray-300 truncate">{audioName}</p>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-400">Import audio file</p>
                    <p className="text-xs text-gray-600">MP3, WAV, OGG, FLAC</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Whisper Model Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Whisper Model</label>
          <div className="grid grid-cols-5 gap-1 bg-surface-200 p-1 rounded-lg">
            {WHISPER_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setWhisperModel(m.id)}
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  whisperModel === m.id ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
                }`}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Language <span className="text-gray-500 font-normal">(optional, auto-detect if empty)</span>
          </label>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="e.g. ar, en, fr"
            className="input-field text-sm"
          />
        </div>

        {/* Transcribe Button */}
        <button
          onClick={handleTranscribe}
          disabled={!audioBlob || transcribing}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {transcribing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Transcribing...
            </>
          ) : (
            'Transcribe'
          )}
        </button>

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Result</label>
              <button
                onClick={handleCopy}
                className="btn-ghost text-xs flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="glass-card p-4">
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap" dir="auto">
                {result}
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
