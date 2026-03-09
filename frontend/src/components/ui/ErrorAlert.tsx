import { AlertTriangle, X } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  message: string
  description?: string
  onDismiss?: () => void
  onRetry?: () => void
  className?: string
}

export function ErrorAlert({ message, description, onDismiss, onRetry, className }: ErrorAlertProps) {
  return (
    <div className={cn('rounded-lg border border-status-danger/20 bg-status-danger/10 p-4', className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-status-danger" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-status-danger">{message}</p>
          {description && (
            <p className="mt-1 text-sm text-status-danger/80">{description}</p>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-status-danger underline hover:no-underline"
            >
              Try again
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-status-danger/60 hover:text-status-danger"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
