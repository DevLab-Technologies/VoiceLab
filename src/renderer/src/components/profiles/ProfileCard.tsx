import { Trash2, Edit3, Play, Pause, Languages, Globe } from 'lucide-react'
import { useState, useRef } from 'react'
import type { Profile } from '../../types/profile'
import { DIALECT_MAP, MODEL_INFO, LANGUAGE_MAP } from '../../lib/constants'
import { formatDuration, formatDate } from '../../lib/utils'
import { getProfileAudioUrl } from '../../api/audio'

interface ProfileCardProps {
  profile: Profile
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export default function ProfileCard({ profile, onEdit, onDelete }: ProfileCardProps) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const modelId = profile.model || 'habibi-tts'
  const modelInfo = MODEL_INFO[modelId]
  const isHabibi = modelId === 'habibi-tts'

  const dialect = profile.dialect ? DIALECT_MAP[profile.dialect] : null
  const language = profile.language ? LANGUAGE_MAP[profile.language] : null

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!audioRef.current) {
      audioRef.current = new Audio(getProfileAudioUrl(profile.id))
      audioRef.current.onended = () => setPlaying(false)
    }

    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  return (
    <div className="glass-card-hover p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{profile.name}</h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Model badge */}
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-surface-300 text-gray-400">
              {isHabibi ? <Languages className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
              {modelInfo?.name || modelId}
            </span>

            {/* Dialect or Language badge */}
            {isHabibi && dialect && (
              <span className="badge-accent">{dialect.nameEn}</span>
            )}
            {!isHabibi && language && (
              <span className="badge-accent">{language.name}</span>
            )}

            <span className="text-xs text-gray-500">
              {formatDuration(profile.ref_audio_duration)}
            </span>
          </div>
        </div>
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center transition-colors shrink-0"
        >
          {playing ? (
            <Pause className="w-3.5 h-3.5 text-accent-light" />
          ) : (
            <Play className="w-3.5 h-3.5 text-accent-light ml-0.5" />
          )}
        </button>
      </div>

      <p className={`text-xs text-gray-500 truncate ${isHabibi ? 'font-arabic' : ''}`} dir={isHabibi ? 'rtl' : 'ltr'}>
        {profile.ref_text}
      </p>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-gray-600">{formatDate(profile.created_at)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(profile.id)}
            className="btn-ghost p-1.5"
            title="Edit"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(profile.id)}
            className="btn-ghost p-1.5 text-gray-400 hover:text-danger"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
