import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Trash2, Download } from 'lucide-react'
import Header from '../components/layout/Header'
import AudioPlayer from '../components/audio/AudioPlayer'
import Dialog from '../components/ui/Dialog'
import Spinner from '../components/ui/Spinner'
import { useAppStore } from '../store'
import { DIALECT_MAP, MODEL_INFO, LANGUAGE_MAP } from '../lib/constants'
import { truncateText, formatDate } from '../lib/utils'
import { getGenerationAudioUrl } from '../api/audio'

export default function HistoryPage() {
  const { generations, fetchGenerations, deleteGeneration } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchGenerations().finally(() => setLoading(false))
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteGeneration(deleteId)
    setDeleteId(null)
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header
        title="History"
        subtitle="All your generated speech"
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : generations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-400 mb-2">No generations yet</h3>
          <p className="text-sm text-gray-600">Generated speech will appear here.</p>
        </div>
      ) : (
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
                  <p className={`text-sm text-gray-300 leading-relaxed ${gen.model === 'habibi-tts' || !gen.model ? 'font-arabic' : ''}`} dir={gen.model === 'habibi-tts' || !gen.model ? 'rtl' : 'ltr'}>
                    {truncateText(gen.text, 120)}
                  </p>
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
                    <span className="text-[10px] text-gray-600">{formatDate(gen.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button
                    onClick={() => handleExport(gen.id)}
                    className="btn-ghost p-1.5"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(gen.id)}
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
      )}

      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Generation"
        actions={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </>
        }
      >
        <p>Delete this generated audio? This cannot be undone.</p>
      </Dialog>
    </motion.div>
  )
}
