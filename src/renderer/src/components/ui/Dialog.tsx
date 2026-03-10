import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  actions?: ReactNode
}

export default function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative glass-card p-6 w-full max-w-md mx-4 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
            <div className="text-gray-300 text-sm">{children}</div>
            {actions && <div className="flex justify-end gap-3 mt-6">{actions}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
