import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2, ClipboardCopy, Square, SlidersHorizontal, RotateCcw } from 'lucide-react'
import Header from '../components/layout/Header'
import ProfileSelector from '../components/profiles/ProfileSelector'
import AudioPlayer from '../components/audio/AudioPlayer'
import { useAppStore } from '../store'
import { getGenerationAudioUrl } from '../api/audio'
import { buildDebugData } from '../lib/debug'

export default function TTSPage() {
  const {
    profiles,
    fetchProfiles,
    selectedProfileId,
    generationText,
    setGenerationText,
    isGenerating,
    currentGeneration,
    generate,
    stopGeneration,
    devMode,
    backendReady,
    addToast,
    appVersion,
    genSpeed,
    genNfeStep,
    genCfgStrength,
    setGenSpeed,
    setGenNfeStep,
    setGenCfgStrength
  } = useAppStore()

  const [showParams, setShowParams] = useState(false)

  useEffect(() => {
    if (profiles.length === 0) fetchProfiles()
  }, [])

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)
  const isRTL = selectedProfile?.model === 'habibi-tts' || (!selectedProfile?.model)
  const canGenerate = selectedProfileId && generationText.trim() && !isGenerating

  const copyDebugData = async () => {
    if (!currentGeneration) return
    const debugData = buildDebugData(currentGeneration, selectedProfile, { version: appVersion, backendReady })
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugData, null, 2))
      addToast('Debug data copied to clipboard', 'success')
    } catch {
      addToast('Failed to copy debug data', 'error')
    }
  }

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

        {/* Advanced Parameters (HabibiTTS only) */}
        {isRTL && (
          <div>
            <button
              onClick={() => setShowParams(!showParams)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showParams ? 'Hide' : 'Show'} Parameters
            </button>
            <AnimatePresence>
              {showParams && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="glass-card p-4 mt-3 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Generation Parameters</span>
                      <button
                        onClick={() => { setGenSpeed(1.0); setGenNfeStep(32); setGenCfgStrength(2.0) }}
                        className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    </div>

                    {/* Speed */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400">Speed</label>
                        <span className="text-xs text-gray-500 font-mono">{genSpeed.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={genSpeed}
                        onChange={(e) => setGenSpeed(parseFloat(e.target.value))}
                        className="w-full accent-accent"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>Slower</span>
                        <span>Faster</span>
                      </div>
                    </div>

                    {/* Quality Steps */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400">Quality Steps</label>
                        <span className="text-xs text-gray-500 font-mono">{genNfeStep}</span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="64"
                        step="4"
                        value={genNfeStep}
                        onChange={(e) => setGenNfeStep(parseInt(e.target.value))}
                        className="w-full accent-accent"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>Fast</span>
                        <span>High Quality</span>
                      </div>
                    </div>

                    {/* Text Adherence */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400">Text Adherence</label>
                        <span className="text-xs text-gray-500 font-mono">{genCfgStrength.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="5.0"
                        step="0.5"
                        value={genCfgStrength}
                        onChange={(e) => setGenCfgStrength(parseFloat(e.target.value))}
                        className="w-full accent-accent"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>Creative</span>
                        <span>Strict</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Generate / Stop Buttons */}
        {isGenerating ? (
          <button
            onClick={stopGeneration}
            className="w-full flex items-center justify-center gap-2 py-3 text-base rounded-xl font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop Generation
          </button>
        ) : (
          <button
            onClick={generate}
            disabled={!canGenerate}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
          >
            <Sparkles className="w-5 h-5" />
            Generate Speech
          </button>
        )}

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
            {devMode && (
              <button
                onClick={copyDebugData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-surface-200"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                Copy Debug Data
              </button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
