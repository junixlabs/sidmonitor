import { cn } from '@/lib/utils'
import { formatLatency, formatCount } from '@/utils/format'
import type { OutboundStats } from '../../types'

interface OutboundStatsCardsProps {
  stats?: OutboundStats
  loading?: boolean
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color: string
  loading?: boolean
}

function StatCard({ title, value, subtitle, icon, color, loading = false }: StatCardProps) {
  return (
    <div className="bg-surface rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={cn('flex-shrink-0 rounded-md p-3', color)}>
          {icon}
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-text-muted truncate">{title}</dt>
            <dd className="flex items-baseline">
              {loading ? (
                <div className="h-8 w-20 bg-surface-tertiary animate-pulse rounded" />
              ) : (
                <>
                  <span className="text-2xl font-semibold text-text-primary">{value}</span>
                  {subtitle && (
                    <span className="ml-2 text-sm text-text-muted">{subtitle}</span>
                  )}
                </>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  )
}

export default function OutboundStatsCards({ stats, loading = false }: OutboundStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Outbound Requests"
        value={formatCount(stats?.total_requests || 0)}
        icon={
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        }
        color="bg-accent"
        loading={loading}
      />

      <StatCard
        title="Error Rate"
        value={`${(stats?.error_rate || 0).toFixed(2)}%`}
        icon={
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        color={(stats?.error_rate || 0) > 5 ? 'bg-status-danger' : (stats?.error_rate || 0) > 1 ? 'bg-status-warning' : 'bg-status-success'}
        loading={loading}
      />

      <StatCard
        title="Avg Latency"
        value={formatLatency(stats?.avg_latency_ms || 0)}
        icon={
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        color="bg-status-info"
        loading={loading}
      />

      <StatCard
        title="P95 Latency"
        value={formatLatency(stats?.p95_latency_ms || 0)}
        icon={
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
        color={(stats?.p95_latency_ms || 0) > 1000 ? 'bg-status-warning' : 'bg-status-success'}
        loading={loading}
      />
    </div>
  )
}
