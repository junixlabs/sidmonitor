import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className={cn(
            'w-full rounded-lg bg-surface shadow-xl',
            'max-h-[80vh] overflow-y-auto',
            sizeClasses[size],
            className
          )}
        >
          <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
            <DialogTitle className="text-lg font-medium text-text-primary">
              {title}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div className="px-6 py-4">{children}</div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
