import { ChevronDown, User } from 'lucide-react'
import { useAppStore } from '../../store'
import { DIALECT_MAP, MODEL_INFO, LANGUAGE_MAP } from '../../lib/constants'

export default function ProfileSelector() {
  const { profiles, selectedProfileId, setSelectedProfileId } = useAppStore()

  const getProfileLabel = (p: typeof profiles[0]) => {
    const modelName = MODEL_INFO[p.model]?.name || p.model
    if (p.model === 'habibi-tts' && p.dialect) {
      return `${p.name} — ${DIALECT_MAP[p.dialect]?.nameEn || p.dialect}`
    }
    if (p.model === 'qwen3-tts' && p.language) {
      return `${p.name} — ${LANGUAGE_MAP[p.language]?.name || p.language}`
    }
    return `${p.name} — ${modelName}`
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-2">Voice Profile</label>
      <div className="relative">
        <select
          value={selectedProfileId || ''}
          onChange={(e) => setSelectedProfileId(e.target.value || null)}
          className="input-field appearance-none pr-10"
        >
          <option value="">Select a voice profile</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {getProfileLabel(p)}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      {profiles.length === 0 && (
        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          No profiles yet. Create one in the Profiles page.
        </p>
      )}
    </div>
  )
}
