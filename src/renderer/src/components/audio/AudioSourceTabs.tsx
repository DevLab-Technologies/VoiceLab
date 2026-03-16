type Tab = 'record' | 'import' | 'youtube'

interface AudioSourceTabsProps {
  value: Tab
  onChange: (tab: Tab) => void
  tabs?: Tab[]
}

const TAB_LABELS: Record<Tab, string> = {
  record: 'Record',
  import: 'Import',
  youtube: 'YouTube',
}

export default function AudioSourceTabs({
  value,
  onChange,
  tabs = ['record', 'import', 'youtube'],
}: AudioSourceTabsProps) {
  return (
    <div className="flex gap-1 bg-surface-200 p-1 rounded-lg w-fit">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            value === tab ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  )
}
