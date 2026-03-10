import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useAppStore } from '../../store'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info
}

const colors = {
  success: 'border-success/30 bg-success/10',
  error: 'border-danger/30 bg-danger/10',
  info: 'border-accent/30 bg-accent/10'
}

export default function Toast() {
  const { toasts, dismissToast } = useAppStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type]
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md ${colors[toast.type]}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm text-white">{toast.message}</span>
              <button onClick={() => dismissToast(toast.id)} className="ml-2 text-gray-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
