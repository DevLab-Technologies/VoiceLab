import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { MessageSquareText, Users, Clock, AudioLines, Settings, Volume2, Boxes, RefreshCw, Loader2, CheckCircle, ArrowDownToLine } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store'

const navItems = [
  { to: '/', icon: MessageSquareText, label: 'Generate' },
  { to: '/stt', icon: AudioLines, label: 'Transcribe' },
  { to: '/profiles', icon: Users, label: 'Profiles' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/models', icon: Boxes, label: 'Models' },
  { to: '/settings', icon: Settings, label: 'Settings' }
]

export default function Sidebar() {
  const {
    backendReady,
    appVersion, updateStatus, updateVersion, updateProgress,
    initUpdateListener, checkForUpdates, downloadUpdate, installUpdate
  } = useAppStore()

  useEffect(() => {
    return initUpdateListener()
  }, [initUpdateListener])

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

      {/* Status + Version */}
      <div className="px-4 py-4 border-t border-white/5 space-y-2.5">
        <div className="flex items-center gap-2 text-xs">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              backendReady ? 'bg-success' : 'bg-danger animate-pulse'
            )}
          />
          <span className="text-gray-500">
            {backendReady ? 'Ready' : 'Connecting...'}
          </span>
        </div>

        {/* Version + Update */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-600">v{appVersion}</span>
          <div>
            {updateStatus === 'idle' && (
              <button
                onClick={checkForUpdates}
                className="text-[10px] text-gray-500 hover:text-accent transition-colors flex items-center gap-1"
                title="Check for updates"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            {updateStatus === 'checking' && (
              <Loader2 className="w-3 h-3 text-gray-500 animate-spin" />
            )}
            {updateStatus === 'up-to-date' && (
              <CheckCircle className="w-3 h-3 text-success" title="Up to date" />
            )}
            {updateStatus === 'available' && (
              <button
                onClick={downloadUpdate}
                className="text-[10px] text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                title={`Download v${updateVersion}`}
              >
                <ArrowDownToLine className="w-3 h-3" />
                <span>v{updateVersion}</span>
              </button>
            )}
            {updateStatus === 'downloading' && (
              <span className="text-[10px] text-accent flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {updateProgress}%
              </span>
            )}
            {updateStatus === 'downloaded' && (
              <button
                onClick={installUpdate}
                className="text-[10px] text-success hover:text-success/80 transition-colors"
              >
                Install
              </button>
            )}
            {updateStatus === 'error' && (
              <button
                onClick={checkForUpdates}
                className="text-[10px] text-danger hover:text-danger/80 transition-colors"
                title="Retry"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
