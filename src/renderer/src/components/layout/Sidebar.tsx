import { NavLink } from 'react-router-dom'
import { MessageSquareText, Users, Clock, Settings, Volume2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store'

const navItems = [
  { to: '/', icon: MessageSquareText, label: 'Generate' },
  { to: '/profiles', icon: Users, label: 'Profiles' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' }
]

export default function Sidebar() {
  const { backendReady, modelLoaded } = useAppStore()

  return (
    <aside className="w-[220px] h-screen flex flex-col bg-surface border-r border-white/5 shrink-0">
      {/* Titlebar drag area */}
      <div className="titlebar-drag h-12 flex items-center px-5 pt-1">
        <div className="titlebar-no-drag flex items-center gap-2.5 pl-16">
          <Volume2 className="w-5 h-5 text-accent" />
          <span className="font-semibold text-sm tracking-wide">VoiceLab</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-accent/10 text-accent-light'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )
            }
          >
            <Icon className="w-[18px] h-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Status */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              !backendReady ? 'bg-danger animate-pulse' : modelLoaded ? 'bg-success' : 'bg-warning animate-pulse-slow'
            )}
          />
          <span className="text-gray-500">
            {!backendReady ? 'Connecting...' : modelLoaded ? 'Ready' : 'Loading model...'}
          </span>
        </div>
      </div>
    </aside>
  )
}
