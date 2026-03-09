import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-tertiary text-text-secondary',
  success: 'bg-status-success/10 text-status-success',
  warning: 'bg-status-warning/10 text-status-warning',
  danger: 'bg-status-danger/10 text-status-danger',
  info: 'bg-status-info/10 text-status-info',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
