import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react'
import Header from '../components/layout/Header'
import ModelSelector from '../components/profiles/ModelSelector'
import DialectSelector from '../components/profiles/DialectSelector'
import LanguageSelector from '../components/profiles/LanguageSelector'
import AudioPlayer from '../components/audio/AudioPlayer'
import Spinner from '../components/ui/Spinner'
import { useAppStore } from '../store'
import { updateProfile } from '../api/profiles'
import { getProfileAudioUrl } from '../api/audio'
import { extractApiError } from '../lib/utils'
import type { DialectCode } from '../types/dialect'
import type { ModelId } from '../types/model'

export default function EditProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profiles, fetchProfiles, addToast, availableModels, fetchModels } = useAppStore()

  const [name, setName] = useState('')
  const [model, setModel] = useState<ModelId>('habibi-tts')
  const [dialect, setDialect] = useState<DialectCode>('MSA')
  const [language, setLanguage] = useState('English')
  const [refText, setRefText] = useState('')
  const [originalModel, setOriginalModel] = useState<ModelId>('habibi-tts')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const profile = profiles.find((p) => p.id === id)
  const isHabibi = model === 'habibi-tts'
  const modelChanged = model !== originalModel

  useEffect(() => {
    if (profiles.length === 0) fetchProfiles()
    fetchModels()
  }, [])

  useEffect(() => {
    if (profiles.length === 0) return
    if (!profile) {
      addToast('Profile not found', 'error')
      navigate('/profiles')
      return
    }
    setName(profile.name)
    const profileModel = (profile.model || 'habibi-tts') as ModelId
    setModel(profileModel)
    setOriginalModel(profileModel)
    if (profile.dialect) setDialect(profile.dialect)
    if (profile.language) setLanguage(profile.language)
    setRefText(profile.ref_text)
    setLoading(false)
  }, [profile, profiles.length])

  const handleSave = async () => {
    if (!id || !name.trim() || !refText.trim()) return
    setSaving(true)
    try {
      await updateProfile(id, {
        name,
        model,
        ...(isHabibi ? { dialect } : {}),
        ...(!isHabibi ? { language } : {}),
        ref_text: refText
      })
      await fetchProfiles()
      addToast('Profile updated', 'success')
      navigate('/profiles')
    } catch (err: any) {
      addToast(extractApiError(err, 'Failed to update'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header
        title="Edit Profile"
        actions={
          <button onClick={() => navigate('/profiles')} className="btn-ghost flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        }
      />

      <div className="max-w-xl space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Profile Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        </div>

        {/* Model Selector */}
        <ModelSelector
          value={model}
          onChange={setModel}
          availableModels={availableModels}
        />

        {modelChanged && (
          <div className="flex items-start gap-2 text-sm text-yellow-400 bg-yellow-400/10 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Changing the TTS model may affect output quality if the reference audio was recorded for a different model.</span>
          </div>
        )}

        {/* Dialect or Language */}
        {isHabibi ? (
          <DialectSelector value={dialect} onChange={setDialect} />
        ) : (
          <LanguageSelector value={language} onChange={setLanguage} />
        )}

        {profile && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Reference Audio</label>
            <AudioPlayer url={getProfileAudioUrl(profile.id)} compact />
            <p className="text-xs text-gray-600 mt-2">Audio cannot be changed. Create a new profile for a different voice sample.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reference Transcription
          </label>
          <textarea
            dir={isHabibi ? 'rtl' : 'ltr'}
            value={refText}
            onChange={(e) => setRefText(e.target.value)}
            rows={3}
            className={`input-field text-base leading-relaxed resize-none ${isHabibi ? 'font-arabic' : ''}`}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!name.trim() || !refText.trim() || saving}
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
              Save Changes
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
