import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: number
    is_positive: boolean
  }
  color?: 'indigo' | 'red' | 'yellow' | 'green' | 'blue'
  loading?: boolean
  severity?: 'critical' | 'warning' | 'normal'
}

const colorConfig = {
  indigo: {
    icon: 'bg-accent/15 text-accent',
    accent: 'text-accent',
  },
  red: {
    icon: 'bg-status-danger/15 text-status-danger',
    accent: 'text-status-danger',
  },
  yellow: {
    icon: 'bg-status-warning/15 text-status-warning',
    accent: 'text-status-warning',
  },
  green: {
    icon: 'bg-status-success/15 text-status-success',
    accent: 'text-status-success',
  },
  blue: {
    icon: 'bg-status-info/15 text-status-info',
    accent: 'text-status-info',
  },
}

const severityClasses = {
  critical: 'ring-2 ring-status-danger/50 ring-offset-1 ring-offset-surface',
  warning: 'ring-2 ring-status-warning/40 ring-offset-1 ring-offset-surface',
  normal: '',
}

export default function StatsCard({
  title,
  value,
  icon,
  trend,
  color = 'indigo',
  loading = false,
  severity,
}: StatsCardProps) {
  const colors = colorConfig[color]

  return (
    <div className={cn(
      'bg-surface rounded-xl border border-border-subtle p-5 transition-all duration-200 hover:border-border-primary',
      severity && severityClasses[severity]
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text-muted">{title}</span>
        {icon ? (
          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', colors.icon)}>
            {icon}
          </div>
        ) : (
          <div className={cn('h-2 w-2 rounded-full', colors.icon.replace('/15', ''))} />
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-24 bg-surface-tertiary animate-pulse rounded" />
          <div className="h-4 w-16 bg-surface-tertiary/50 animate-pulse rounded" />
        </div>
      ) : (
        <>
          <div className={cn(
            'text-2xl font-bold tracking-tight',
            severity === 'critical' ? 'text-status-danger' :
            severity === 'warning' ? 'text-status-warning' :
            'text-text-primary'
          )}>
            {value}
          </div>

          {trend && (
            <div className="flex items-center gap-1 mt-1.5">
              {trend.is_positive ? (
                <TrendingUp className="w-3.5 h-3.5 text-status-success" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-status-danger" />
              )}
              <span className={cn(
                'text-xs font-medium',
                trend.is_positive ? 'text-status-success' : 'text-status-danger'
              )}>
                {trend.is_positive ? '+' : ''}{trend.value.toFixed(1)}%
              </span>
              <span className="text-xs text-text-muted">vs prev period</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
