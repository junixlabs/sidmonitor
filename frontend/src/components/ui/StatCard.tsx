import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { Card } from './Card'
import { Skeleton } from './Skeleton'

type Severity = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  trend?: { value: string; direction: 'up' | 'down' }
  severity?: Severity
  loading?: boolean
  className?: string
}

const iconBgClasses: Record<Severity, string> = {
  default: 'bg-accent/10 text-accent',
  success: 'bg-status-success/10 text-status-success',
  warning: 'bg-status-warning/10 text-status-warning',
  danger: 'bg-status-danger/10 text-status-danger',
  info: 'bg-status-info/10 text-status-info',
}

export function StatCard({ icon, label, value, trend, severity = 'default', loading, className }: StatCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <div className="flex items-center gap-4">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', iconBgClasses[severity])}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-secondary">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-text-primary">{value}</p>
            {trend && (
              <span className={cn(
                'text-xs font-medium',
                trend.direction === 'up' ? 'text-status-success' : 'text-status-danger'
              )}>
                {trend.direction === 'up' ? '+' : ''}{trend.value}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
