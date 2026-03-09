import type { ReactNode } from 'react'

import { RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'

interface FilterBarProps {
  children: ReactNode
  onReset?: () => void
  showReset?: boolean
  className?: string
}

export function FilterBar({ children, onReset, showReset, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {children}
      {showReset && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      )}
    </div>
  )
}
