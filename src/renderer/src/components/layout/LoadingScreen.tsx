import { motion, AnimatePresence } from 'framer-motion'
import { Volume2 } from 'lucide-react'

interface LoadingScreenProps {
  stage?: string
  message?: string
}

const STAGE_ORDER: Record<string, number> = {
  connecting: 0,
  environment: 1,
  dependencies: 2,
  spawning: 3,
  health: 4,
  ready: 5,
  error: -1
}

function getProgressWidth(stage?: string): string {
  if (!stage || stage === 'error') return '5%'
  const steps = STAGE_ORDER[stage] ?? 0
  const total = 5
  const pct = Math.round((steps / total) * 90) + 5
  return `${pct}%`
}

export default function LoadingScreen({ stage, message }: LoadingScreenProps) {
  const isError = stage === 'error'
  const progressWidth = getProgressWidth(stage)

  return (
    <div
      className="h-screen flex flex-col items-center justify-center select-none"
      style={{ background: '#0f1117' }}
    >
      {/* Logo block */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="flex flex-col items-center mb-14"
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(99,102,241,0.12)' }}
        >
          <Volume2 className="w-10 h-10" style={{ color: '#6366f1' }} />
        </div>
        <h1 className="text-2xl font-semibold tracking-wide" style={{ color: '#f1f5f9' }}>
          VoiceLab
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          Multi-Model TTS Studio
        </p>
      </motion.div>

      {/* Status area */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="flex flex-col items-center gap-5"
        style={{ width: 300 }}
      >
        {/* Animated dots or error indicator */}
        {isError ? (
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: '#ef4444' }}
          />
        ) : (
          <div className="flex gap-1.5 items-center">
            {[0, 1, 2].map((dot) => (
              <motion.div
                key={dot}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#6366f1' }}
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: dot * 0.22,
                  ease: 'easeInOut'
                }}
              />
            ))}
          </div>
        )}

        {/* Message with smooth crossfade on change */}
        <AnimatePresence mode="wait">
          <motion.p
            key={message ?? 'default'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="text-sm text-center leading-relaxed"
            style={{ color: isError ? '#f87171' : '#94a3b8' }}
          >
            {message ?? 'Starting...'}
          </motion.p>
        </AnimatePresence>

        {/* Thin progress track */}
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 2, background: 'rgba(255,255,255,0.07)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isError
                ? '#ef4444'
                : 'linear-gradient(90deg, #6366f1, #818cf8)'
            }}
            initial={{ width: '5%' }}
            animate={{ width: progressWidth }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        </div>
      </motion.div>
    </div>
  )
}
