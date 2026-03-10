import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2 } from 'lucide-react'
import Header from '../components/layout/Header'
import ProfileSelector from '../components/profiles/ProfileSelector'
import AudioPlayer from '../components/audio/AudioPlayer'
import { useAppStore } from '../store'
import { getGenerationAudioUrl } from '../api/audio'

export default function TTSPage() {
  const {
    profiles,
    fetchProfiles,
    selectedProfileId,
    generationText,
    setGenerationText,
    isGenerating,
    currentGeneration,
    generate
  } = useAppStore()

  useEffect(() => {
    if (profiles.length === 0) fetchProfiles()
  }, [])

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)
  const isRTL = selectedProfile?.model === 'habibi-tts' || (!selectedProfile?.model)
  const canGenerate = selectedProfileId && generationText.trim() && !isGenerating

  const handleExport = async () => {
    if (!currentGeneration) return
    const url = getGenerationAudioUrl(currentGeneration.id)
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = blobUrl
      a.download = `voicelab-${currentGeneration.id.slice(0, 8)}.wav`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      }, 100)
    } catch {
      useAppStore.getState().addToast('Export failed', 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header
        title="Generate Speech"
        subtitle="Select a voice profile and enter text to generate speech"
      />

      <div className="max-w-2xl space-y-6">
        {/* Profile Selector */}
        <ProfileSelector />

        {/* Text Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Text to speak
          </label>
          <textarea
            dir={isRTL ? 'rtl' : 'ltr'}
            value={generationText}
            onChange={(e) => setGenerationText(e.target.value)}
            placeholder={isRTL ? 'اكتب النص هنا...' : 'Type your text here...'}
            rows={5}
            className={`input-field text-base leading-relaxed resize-none ${isRTL ? 'font-arabic' : ''}`}
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-gray-600">
              {generationText.length} / 5000
            </span>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generate}
          disabled={!canGenerate}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Speech
            </>
          )}
        </button>

        {/* Result */}
        {currentGeneration && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-300">Generated Audio</h3>
              <span className="badge-success">{currentGeneration.duration}s</span>
            </div>
            <AudioPlayer
              url={getGenerationAudioUrl(currentGeneration.id)}
              onExport={handleExport}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
