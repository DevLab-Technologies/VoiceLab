import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Trash2, Download, ClipboardCopy, RotateCcw, Copy, Check, AudioLines, Timer } from 'lucide-react'
import Header from '../components/layout/Header'
import AudioPlayer from '../components/audio/AudioPlayer'
import Dialog from '../components/ui/Dialog'
import Spinner from '../components/ui/Spinner'
import { useAppStore } from '../store'
import { DIALECT_MAP, MODEL_INFO, LANGUAGE_MAP } from '../lib/constants'
import { truncateText, formatDate, formatElapsed } from '../lib/utils'
import { getGenerationAudioUrl, getTranscriptionAudioUrl } from '../api/audio'

const WHISPER_MODEL_NAMES: Record<string, string> = {
  'openai/whisper-tiny': 'Whisper Tiny',
  'openai/whisper-base': 'Whisper Base',
  'openai/whisper-small': 'Whisper Small',
  'openai/whisper-large-v3-turbo': 'Whisper Large V3 Turbo'
}

export default function HistoryPage() {
  const {
    generations, fetchGenerations, deleteGeneration, prepareRegeneration,
    transcriptions, fetchTranscriptions, deleteTranscription,
    devMode, profiles, backendReady, addToast
  } = useAppStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteType, setDeleteType] = useState<'generation' | 'transcription'>('generation')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'generated' | 'transcribed'>('generated')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchGenerations(),
      fetchTranscriptions()
    ]).finally(() => setLoading(false))
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    if (deleteType === 'generation') {
      await deleteGeneration(deleteId)
    } else {
      await deleteTranscription(deleteId)
    }
    setDeleteId(null)
  }

  const copyDebugData = async (gen: typeof generations[0]) => {
    const profile = profiles.find((p) => p.id === gen.profile_id)
    const debugData = {
      generation_id: gen.id,
      profile: profile
        ? {
            id: profile.id,
            name: profile.name,
            model: profile.model || 'habibi-tts',
            dialect: profile.dialect || null,
            language: profile.language || null,
            ref_text: profile.ref_text,
            ref_audio_duration: profile.ref_audio_duration
          }
        : { id: gen.profile_id, name: gen.profile_name },
      input: {
        text: gen.text,
        text_length: gen.text.length
      },
      output: {
        duration: gen.duration,
        elapsed_seconds: gen.elapsed_seconds || 0,
        audio_path: gen.audio_path,
        model: gen.model || 'habibi-tts',
        dialect: gen.dialect || null,
        language: gen.language || null
      },
      app: {
        version: '1.0.0',
        backend_ready: backendReady,
        platform: navigator.platform
      },
      created_at: gen.created_at
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugData, null, 2))
      addToast('Debug data copied to clipboard', 'success')
    } catch {
      addToast('Failed to copy debug data', 'error')
    }
  }

  const handleExport = async (id: string) => {
    const url = getGenerationAudioUrl(id)
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = blobUrl
      a.download = `voicelab-${id.slice(0, 8)}.wav`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      }, 100)
    } catch {
      // silent fail
    }
  }

  const handleCopyTranscription = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      addToast('Copied to clipboard', 'success')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      addToast('Failed to copy', 'error')
    }
  }

  const isEmpty = activeTab === 'generated' ? generations.length === 0 : transcriptions.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header
        title="History"
        subtitle="Generated speech and transcriptions"
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-200 p-1 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setActiveTab('generated')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'generated' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Generated{generations.length > 0 ? ` (${generations.length})` : ''}
        </button>
        <button
          onClick={() => setActiveTab('transcribed')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'transcribed' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Transcribed{transcriptions.length > 0 ? ` (${transcriptions.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            {activeTab === 'generated' ? (
              <Clock className="w-8 h-8 text-gray-600" />
            ) : (
              <AudioLines className="w-8 h-8 text-gray-600" />
            )}
          </div>
          <h3 className="text-lg font-medium text-gray-400 mb-2">
            {activeTab === 'generated' ? 'No generations yet' : 'No transcriptions yet'}
          </h3>
          <p className="text-sm text-gray-600">
            {activeTab === 'generated'
              ? 'Generated speech will appear here.'
              : 'Transcribed audio will appear here.'}
          </p>
        </div>
      ) : activeTab === 'generated' ? (
        /* Generated Tab */
        <div className="space-y-3 max-w-2xl">
          {generations.map((gen, i) => (
            <motion.div
              key={gen.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm text-gray-300 leading-relaxed cursor-pointer hover:text-gray-200 transition-colors ${gen.model === 'habibi-tts' || !gen.model ? 'font-arabic' : ''}`}
                    dir={gen.model === 'habibi-tts' || !gen.model ? 'rtl' : 'ltr'}
                    onClick={() => setExpandedId(expandedId === gen.id ? null : gen.id)}
                    title={expandedId === gen.id ? 'Click to collapse' : 'Click to expand'}
                  >
                    {expandedId === gen.id ? gen.text : truncateText(gen.text, 120)}
                  </p>
                  {gen.text.length > 120 && (
                    <button
                      onClick={() => setExpandedId(expandedId === gen.id ? null : gen.id)}
                      className="text-[10px] text-accent hover:text-accent/80 mt-1 transition-colors"
                    >
                      {expandedId === gen.id ? 'Show less' : 'Show more'}
                    </button>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-300 text-gray-400">
                      {MODEL_INFO[gen.model || 'habibi-tts']?.name || gen.model || 'HabibiTTS'}
                    </span>
                    {(gen.model === 'habibi-tts' || !gen.model) && gen.dialect && (
                      <span className="badge-accent text-[10px]">
                        {DIALECT_MAP[gen.dialect]?.nameEn || gen.dialect}
                      </span>
                    )}
                    {gen.model === 'qwen3-tts' && gen.language && (
                      <span className="badge-accent text-[10px]">
                        {LANGUAGE_MAP[gen.language]?.name || gen.language}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-600">{gen.profile_name}</span>
                    {gen.elapsed_seconds ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-600">
                        <Timer className="w-2.5 h-2.5" />
                        {formatElapsed(gen.elapsed_seconds)}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-gray-600">{formatDate(gen.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button
                    onClick={() => {
                      prepareRegeneration(gen)
                      navigate('/')
                    }}
                    className="btn-ghost p-1.5 text-gray-500 hover:text-accent"
                    title="Regenerate with different parameters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  {devMode && (
                    <button
                      onClick={() => copyDebugData(gen)}
                      className="btn-ghost p-1.5 text-gray-500 hover:text-gray-300"
                      title="Copy Debug Data"
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleExport(gen.id)}
                    className="btn-ghost p-1.5"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setDeleteId(gen.id)
                      setDeleteType('generation')
                    }}
                    className="btn-ghost p-1.5 text-gray-400 hover:text-danger"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <AudioPlayer url={getGenerationAudioUrl(gen.id)} compact />
            </motion.div>
          ))}
        </div>
      ) : (
        /* Transcribed Tab */
        <div className="space-y-3 max-w-2xl">
          {transcriptions.map((trans, i) => (
            <motion.div
              key={trans.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm text-gray-300 leading-relaxed cursor-pointer hover:text-gray-200 transition-colors"
                    dir="auto"
                    onClick={() => setExpandedId(expandedId === trans.id ? null : trans.id)}
                    title={expandedId === trans.id ? 'Click to collapse' : 'Click to expand'}
                  >
                    {expandedId === trans.id ? trans.text : truncateText(trans.text, 120)}
                  </p>
                  {trans.text.length > 120 && (
                    <button
                      onClick={() => setExpandedId(expandedId === trans.id ? null : trans.id)}
                      className="text-[10px] text-accent hover:text-accent/80 mt-1 transition-colors"
                    >
                      {expandedId === trans.id ? 'Show less' : 'Show more'}
                    </button>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-300 text-gray-400">
                      {WHISPER_MODEL_NAMES[trans.model] || trans.model}
                    </span>
                    {trans.elapsed_seconds ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-600">
                        <Timer className="w-2.5 h-2.5" />
                        {formatElapsed(trans.elapsed_seconds)}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-gray-600">{formatDate(trans.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button
                    onClick={() => handleCopyTranscription(trans.id, trans.text)}
                    className="btn-ghost p-1.5 text-gray-500 hover:text-gray-300"
                    title="Copy text"
                  >
                    {copiedId === trans.id ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteId(trans.id)
                      setDeleteType('transcription')
                    }}
                    className="btn-ghost p-1.5 text-gray-400 hover:text-danger"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <AudioPlayer url={getTranscriptionAudioUrl(trans.id)} compact />
            </motion.div>
          ))}
        </div>
      )}

      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={deleteType === 'generation' ? 'Delete Generation' : 'Delete Transcription'}
        actions={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </>
        }
      >
        <p>
          {deleteType === 'generation'
            ? 'Delete this generated audio? This cannot be undone.'
            : 'Delete this transcription? This cannot be undone.'}
        </p>
      </Dialog>
    </motion.div>
  )
}
