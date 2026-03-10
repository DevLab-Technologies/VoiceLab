import type { DialectCode } from '../../types/dialect'
import { DIALECTS } from '../../lib/constants'

interface DialectSelectorProps {
  value: DialectCode
  onChange: (code: DialectCode) => void
}

export default function DialectSelector({ value, onChange }: DialectSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">Dialect</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DialectCode)}
        className="input-field"
      >
        {DIALECTS.map((d) => (
          <option key={d.code} value={d.code}>
            {d.nameEn} — {d.nameAr}
          </option>
        ))}
      </select>
    </div>
  )
}
