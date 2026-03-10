import { LANGUAGES } from '../../lib/constants'
import { cn } from '../../lib/utils'

interface LanguageSelectorProps {
  value: string
  onChange: (language: string) => void
}

export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-3">Language</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => onChange(lang.code)}
            className={cn(
              'flex flex-col items-start px-3 py-2.5 rounded-lg border transition-all duration-200 text-left',
              value === lang.code
                ? 'border-accent bg-accent/10 text-white'
                : 'border-white/10 bg-surface-200 text-gray-400 hover:border-white/20 hover:text-gray-300'
            )}
          >
            <span className="text-sm font-medium">{lang.name}</span>
            <span className="text-[10px] opacity-60">{lang.nativeName}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
