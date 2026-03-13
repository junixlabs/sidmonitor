import { cn } from '@/lib/utils'
import { Activity, AlertTriangle, AlertCircle } from 'lucide-react'

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

const colorClasses = {
  indigo: 'bg-accent',
  red: 'bg-status-danger',
  yellow: 'bg-status-warning',
  green: 'bg-status-success',
  blue: 'bg-status-info',
}

const severityClasses = {
  critical: 'border-2 border-status-danger animate-pulse',
  warning: 'border-2 border-status-warning',
  normal: '',
}

const severityIconClasses = {
  critical: 'bg-status-danger',
  warning: 'bg-status-warning',
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
  const iconColor = severity ? severityIconClasses[severity] : colorClasses[color]

  return (
    <div className={cn(
      'bg-surface overflow-hidden shadow rounded-lg',
      severity && severityClasses[severity]
    )}>
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div
              className={cn(
                'h-10 w-10 rounded-md flex items-center justify-center',
                iconColor
              )}
            >
              {icon || severity ? (
                severity === 'critical' ? (
                  <AlertTriangle className="h-6 w-6 text-white" />
                ) : severity === 'warning' ? (
                  <AlertCircle className="h-6 w-6 text-white" />
                ) : (
                  <Activity className="h-6 w-6 text-white" />
                )
              ) : (
                <Activity className="h-6 w-6 text-white" />
              )}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-text-secondary truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                {loading ? (
                  <div className="h-6 w-20 bg-surface-tertiary animate-pulse rounded" />
                ) : (
                  <span className={cn(
                    'text-2xl font-semibold',
                    severity === 'critical' ? 'text-status-danger' :
                    severity === 'warning' ? 'text-status-warning' :
                    'text-text-primary'
                  )}>
                    {value}
                  </span>
                )}
                {trend && !loading && (
                  <span
                    className={cn(
                      'ml-2 text-sm font-medium',
                      trend.is_positive ? 'text-status-success' : 'text-status-danger'
                    )}
                  >
                    {trend.is_positive ? '+' : ''}
                    {trend.value}%
                  </span>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
