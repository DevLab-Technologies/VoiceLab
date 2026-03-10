import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Header from '../components/layout/Header'
import ModelSelector from '../components/profiles/ModelSelector'
import DialectSelector from '../components/profiles/DialectSelector'
import LanguageSelector from '../components/profiles/LanguageSelector'
import AudioRecorder from '../components/audio/AudioRecorder'
import AudioImporter from '../components/audio/AudioImporter'
import { useAppStore } from '../store'
import type { DialectCode } from '../types/dialect'
import type { ModelId } from '../types/model'

export default function NewProfilePage() {
  const navigate = useNavigate()
  const { createProfile, addToast, availableModels, fetchModels } = useAppStore()

  const [name, setName] = useState('')
  const [model, setModel] = useState<ModelId>('habibi-tts')
  const [dialect, setDialect] = useState<DialectCode>('MSA')
  const [language, setLanguage] = useState('English')
  const [refText, setRefText] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioSource, setAudioSource] = useState<'record' | 'import'>('record')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchModels()
  }, [])

  const canSave = name.trim() && refText.trim() && audioBlob && !saving

  const handleSave = async () => {
    if (!canSave || !audioBlob) return
    setSaving(true)
    try {
      const filename = audioSource === 'import' ? 'imported.wav' : 'recording.webm'
      await createProfile(
        name,
        model,
        model === 'habibi-tts' ? dialect : undefined,
        model === 'qwen3-tts' ? language : undefined,
        refText,
        audioBlob,
        filename
      )
      navigate('/profiles')
    } catch (err: any) {
      addToast(err?.response?.data?.detail || 'Failed to create profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleImport = (file: File) => {
    setAudioBlob(file)
    setAudioSource('import')
  }

  const handleRecorded = (blob: Blob) => {
    setAudioBlob(blob)
    setAudioSource('record')
  }

  const isRTL = model === 'habibi-tts'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header
        title="Create Voice Profile"
        actions={
          <button onClick={() => navigate('/profiles')} className="btn-ghost flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        }
      />

      <div className="max-w-xl space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Profile Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ahmed - News Anchor"
            className="input-field"
          />
        </div>

        {/* Model Selector */}
        <ModelSelector
          value={model}
          onChange={setModel}
          availableModels={availableModels}
        />

        {/* Dialect (HabibiTTS) or Language (Qwen3-TTS) */}
        {model === 'habibi-tts' ? (
          <DialectSelector value={dialect} onChange={setDialect} />
        ) : (
          <LanguageSelector value={language} onChange={setLanguage} />
        )}

        {/* Audio Source */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Reference Audio</label>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-surface-200 p-1 rounded-lg mb-4 w-fit">
            <button
              onClick={() => setAudioSource('record')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                audioSource === 'record' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Record
            </button>
            <button
              onClick={() => setAudioSource('import')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                audioSource === 'import' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Import
            </button>
          </div>

          {audioSource === 'record' ? (
            <AudioRecorder onRecorded={handleRecorded} />
          ) : (
            <AudioImporter onImported={handleImport} />
          )}
        </div>

        {/* Reference Text */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reference Transcription
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Type the exact words spoken in the reference audio
          </p>
          <textarea
            dir={isRTL ? 'rtl' : 'ltr'}
            value={refText}
            onChange={(e) => setRefText(e.target.value)}
            placeholder={isRTL ? 'اكتب النص المنطوق في التسجيل...' : 'Type the spoken text from the recording...'}
            rows={3}
            className={`input-field text-base leading-relaxed resize-none ${isRTL ? 'font-arabic' : ''}`}
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Create Profile
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
