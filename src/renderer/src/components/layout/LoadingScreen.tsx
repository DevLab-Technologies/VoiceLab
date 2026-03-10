import { motion } from 'framer-motion'
import { Volume2, Server } from 'lucide-react'

interface LoadingScreenProps {
  backendReady: boolean
}

export default function LoadingScreen({ backendReady }: LoadingScreenProps) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-surface">
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-12"
      >
        <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
          <Volume2 className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-wide">VoiceLab</h1>
        <p className="text-sm text-gray-500 mt-1">Multi-Model TTS Studio</p>
      </motion.div>

      {/* Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-4"
      >
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
          <Server className="w-4 h-4 text-accent animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Starting backend server</p>
          <p className="text-xs text-gray-500 mt-0.5">Connecting to Python server...</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((dot) => (
            <motion.div
              key={dot}
              className="w-1.5 h-1.5 rounded-full bg-accent"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: dot * 0.2
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Progress bar */}
      <div className="w-80 mt-10">
        <div className="h-1 bg-surface-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: backendReady ? '100%' : '40%' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}
