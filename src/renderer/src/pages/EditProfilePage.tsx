import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Header from '../components/layout/Header'
import DialectSelector from '../components/profiles/DialectSelector'
import LanguageSelector from '../components/profiles/LanguageSelector'
import AudioPlayer from '../components/audio/AudioPlayer'
import Spinner from '../components/ui/Spinner'
import { useAppStore } from '../store'
import { updateProfile } from '../api/profiles'
import { getProfileAudioUrl } from '../api/audio'
import { MODEL_INFO } from '../lib/constants'
import type { DialectCode } from '../types/dialect'

export default function EditProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profiles, fetchProfiles, addToast } = useAppStore()

  const [name, setName] = useState('')
  const [dialect, setDialect] = useState<DialectCode>('MSA')
  const [language, setLanguage] = useState('English')
  const [refText, setRefText] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const profile = profiles.find((p) => p.id === id)
  const modelId = profile?.model || 'habibi-tts'
  const isHabibi = modelId === 'habibi-tts'

  useEffect(() => {
    if (profiles.length === 0) {
      fetchProfiles()
    }
  }, [])

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      if (profile.dialect) setDialect(profile.dialect)
      if (profile.language) setLanguage(profile.language)
      setRefText(profile.ref_text)
      setLoading(false)
    }
  }, [profile])

  const handleSave = async () => {
    if (!id || !name.trim() || !refText.trim()) return
    setSaving(true)
    try {
      await updateProfile(id, {
        name,
        ...(isHabibi ? { dialect } : {}),
        ...(!isHabibi ? { language } : {}),
        ref_text: refText
      })
      await fetchProfiles()
      addToast('Profile updated', 'success')
      navigate('/profiles')
    } catch (err: any) {
      addToast(err?.response?.data?.detail || 'Failed to update', 'error')
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

        {/* Show model badge (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">TTS Model</label>
          <p className="text-sm text-gray-400 bg-surface-200 px-4 py-2.5 rounded-xl">
            {MODEL_INFO[modelId]?.name || modelId}
          </p>
        </div>

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
