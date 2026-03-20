import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Square,
  SlidersHorizontal,
  RotateCcw,
  ClipboardCopy,
  UserRound,
  Wand2,
  ChevronDown,
  Download,
  Loader2,
  Users
} from 'lucide-react'
import Header from '../components/layout/Header'
import ProfileSelector from '../components/profiles/ProfileSelector'
import AudioPlayer from '../components/audio/AudioPlayer'
import { useAppStore } from '../store'
import { getGenerationAudioUrl } from '../api/audio'
import { buildDebugData } from '../lib/debug'
import { LANGUAGES, SPEAKERS } from '../lib/constants'

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
    setGenCfgStrength,
    generationMode,
    setGenerationMode,
    voiceDesignInstruct,
    setVoiceDesignInstruct,
    voiceDesignLanguage,
    setVoiceDesignLanguage,
    customVoiceSpeaker,
    setCustomVoiceSpeaker,
    customVoiceLanguage,
    setCustomVoiceLanguage,
    customVoiceInstruct,
    setCustomVoiceInstruct,
    availableModels,
    downloadModel,
    fetchModels
  } = useAppStore()

  const [showParams, setShowParams] = useState(false)
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showPresetLanguageDropdown, setShowPresetLanguageDropdown] = useState(false)

  useEffect(() => {
    if (profiles.length === 0) fetchProfiles()
    if (availableModels.length === 0) fetchModels()
  }, [])

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)
  const isRTL = generationMode === 'clone' && (selectedProfile?.model === 'habibi-tts' || !selectedProfile?.model)

  const voiceDesignModel = availableModels.find((m) => m.id === 'qwen3-tts-voice-design')
  const isVoiceDesignReady = voiceDesignModel?.status === 'downloaded' || voiceDesignModel?.status === 'loaded'
  const isVoiceDesignDownloading = voiceDesignModel?.status === 'downloading'

  const customVoiceModel = availableModels.find((m) => m.id === 'qwen3-tts-custom-voice')
  const isCustomVoiceReady = customVoiceModel?.status === 'downloaded' || customVoiceModel?.status === 'loaded'
  const isCustomVoiceDownloading = customVoiceModel?.status === 'downloading'

  const canGenerate =
    generationMode === 'clone'
      ? !!(selectedProfileId && generationText.trim() && !isGenerating)
      : generationMode === 'preset'
        ? !!(isCustomVoiceReady && generationText.trim() && customVoiceSpeaker && !isGenerating)
        : !!(isVoiceDesignReady && generationText.trim() && voiceDesignInstruct.trim() && !isGenerating)

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

  const selectedLanguage = LANGUAGES.find((l) => l.code === voiceDesignLanguage) || LANGUAGES[0]
  const selectedPresetLanguage = LANGUAGES.find((l) => l.code === customVoiceLanguage) || LANGUAGES[0]

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
        {/* Mode Toggle */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-100 w-fit">
          <button
            onClick={() => setGenerationMode('clone')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              generationMode === 'clone'
                ? 'bg-surface-200 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <UserRound className="w-4 h-4" />
            Voice Clone
          </button>
          <button
            onClick={() => setGenerationMode('design')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              generationMode === 'design'
                ? 'bg-surface-200 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Voice Design
          </button>
          <button
            onClick={() => setGenerationMode('preset')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              generationMode === 'preset'
                ? 'bg-surface-200 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Preset Voices
          </button>
        </div>

        {/* Mode Panels */}
        <AnimatePresence mode="wait">
          {generationMode === 'clone' && (
            <motion.div
              key="clone"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
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
            </motion.div>
          )}

          {generationMode === 'design' && (
            <motion.div
              key="design"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-5"
            >
              {/* Model download gate */}
              {!isVoiceDesignReady && (
                <div className="glass-card p-5 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-lg bg-surface-200 text-accent shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">Voice Design model required</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Download the Qwen3-TTS VoiceDesign model (~3.4 GB) to generate voices from text descriptions.
                      </p>
                    </div>
                  </div>

                  {isVoiceDesignDownloading ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Downloading...
                        </span>
                        <span className="font-mono">
                          {voiceDesignModel?.download_progress != null
                            ? `${Math.round(voiceDesignModel.download_progress)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-500"
                          style={{ width: `${voiceDesignModel?.download_progress ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => downloadModel('qwen3-tts-voice-design')}
                      className="btn-primary flex items-center justify-center gap-2 py-2.5 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download Model
                    </button>
                  )}
                </div>
              )}

              {/* Voice design form — only shown when model is ready */}
              {isVoiceDesignReady && (
                <>
                  {/* Language Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Language
                    </label>
                    <div className="relative">
                      <button
                        onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                        className="input-field w-full flex items-center justify-between text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm text-gray-200">{selectedLanguage.name}</span>
                          <span className="text-xs text-gray-500">{selectedLanguage.nativeName}</span>
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-500 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <AnimatePresence>
                        {showLanguageDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-20 top-full mt-1 w-full glass-card p-1 shadow-xl"
                          >
                            {LANGUAGES.map((lang) => (
                              <button
                                key={lang.code}
                                onClick={() => {
                                  setVoiceDesignLanguage(lang.code)
                                  setShowLanguageDropdown(false)
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                  voiceDesignLanguage === lang.code
                                    ? 'bg-surface-300 text-white'
                                    : 'text-gray-400 hover:bg-surface-200 hover:text-gray-200'
                                }`}
                              >
                                <span>{lang.name}</span>
                                <span className="text-xs text-gray-500">{lang.nativeName}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Voice Instruction */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Voice description
                    </label>
                    <textarea
                      dir="ltr"
                      value={voiceDesignInstruct}
                      onChange={(e) => setVoiceDesignInstruct(e.target.value)}
                      placeholder="Describe the voice you want, e.g. 'A warm female voice with a calm, gentle tone'"
                      rows={3}
                      className="input-field text-sm leading-relaxed resize-none"
                    />
                    <p className="text-xs text-gray-600 mt-1.5">
                      Describe accent, gender, tone, pace, or any characteristic you want the voice to have.
                    </p>
                  </div>

                  {/* Text to speak */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Text to speak
                    </label>
                    <textarea
                      dir="ltr"
                      value={generationText}
                      onChange={(e) => setGenerationText(e.target.value)}
                      placeholder="Type your text here..."
                      rows={5}
                      className="input-field text-base leading-relaxed resize-none"
                    />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-gray-600">
                        {generationText.length} / 5000
                      </span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {generationMode === 'preset' && (
            <motion.div
              key="preset"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-5"
            >
              {/* Model download gate */}
              {!isCustomVoiceReady && (
                <div className="glass-card p-5 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-lg bg-surface-200 text-accent shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">Preset Voices model required</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Download the Qwen3-TTS CustomVoice model (~3.4 GB) to use preset speakers.
                      </p>
                    </div>
                  </div>

                  {isCustomVoiceDownloading ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Downloading...
                        </span>
                        <span className="font-mono">
                          {customVoiceModel?.download_progress != null
                            ? `${Math.round(customVoiceModel.download_progress)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-500"
                          style={{ width: `${customVoiceModel?.download_progress ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => downloadModel('qwen3-tts-custom-voice')}
                      className="btn-primary flex items-center justify-center gap-2 py-2.5 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download Model
                    </button>
                  )}
                </div>
              )}

              {/* Preset voices form — only shown when model is ready */}
              {isCustomVoiceReady && (
                <>
                  {/* Speaker selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Speaker
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {SPEAKERS.map((speaker) => (
                        <button
                          key={speaker.id}
                          onClick={() => setCustomVoiceSpeaker(speaker.id)}
                          className={`p-3 rounded-xl text-left transition-colors ${
                            customVoiceSpeaker === speaker.id
                              ? 'bg-accent/15 border border-accent/40 text-white'
                              : 'bg-surface-100 border border-transparent hover:bg-surface-200 text-gray-400'
                          }`}
                        >
                          <div className="text-sm font-medium">{speaker.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{speaker.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Language
                    </label>
                    <div className="relative">
                      <button
                        onClick={() => setShowPresetLanguageDropdown(!showPresetLanguageDropdown)}
                        className="input-field w-full flex items-center justify-between text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm text-gray-200">{selectedPresetLanguage.name}</span>
                          <span className="text-xs text-gray-500">{selectedPresetLanguage.nativeName}</span>
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-500 transition-transform ${showPresetLanguageDropdown ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <AnimatePresence>
                        {showPresetLanguageDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-20 top-full mt-1 w-full glass-card p-1 shadow-xl"
                          >
                            {LANGUAGES.map((lang) => (
                              <button
                                key={lang.code}
                                onClick={() => {
                                  setCustomVoiceLanguage(lang.code)
                                  setShowPresetLanguageDropdown(false)
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                  customVoiceLanguage === lang.code
                                    ? 'bg-surface-300 text-white'
                                    : 'text-gray-400 hover:bg-surface-200 hover:text-gray-200'
                                }`}
                              >
                                <span>{lang.name}</span>
                                <span className="text-xs text-gray-500">{lang.nativeName}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Style instruction (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Style instruction <span className="text-gray-600 font-normal">(optional)</span>
                    </label>
                    <textarea
                      dir="ltr"
                      value={customVoiceInstruct}
                      onChange={(e) => setCustomVoiceInstruct(e.target.value)}
                      placeholder="Optional: describe the style, e.g. 'speak slowly and cheerfully'"
                      rows={2}
                      className="input-field text-sm leading-relaxed resize-none"
                    />
                  </div>

                  {/* Text to speak */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Text to speak
                    </label>
                    <textarea
                      dir="ltr"
                      value={generationText}
                      onChange={(e) => setGenerationText(e.target.value)}
                      placeholder="Type your text here..."
                      rows={5}
                      className="input-field text-base leading-relaxed resize-none"
                    />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-gray-600">
                        {generationText.length} / 5000
                      </span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

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
            {generationMode === 'design' ? (
              <Wand2 className="w-5 h-5" />
            ) : generationMode === 'preset' ? (
              <Users className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
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
