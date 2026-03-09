import { cn } from '@/lib/utils'
import { formatResponseTime, formatCount } from '@/utils/format'
import type { InboundStats } from '../../types'

interface InboundStatsCardsProps {
  stats?: InboundStats
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

export default function InboundStatsCards({ stats, loading = false }: InboundStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Requests"
        value={formatCount(stats?.total_requests || 0)}
        icon={
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        }
        color="bg-accent"
        loading={loading}
      />

      <StatCard
        title="Success Rate"
        value={`${(stats?.success_rate || 0).toFixed(2)}%`}
        icon={
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        color={(stats?.success_rate || 0) < 95 ? 'bg-status-danger' : (stats?.success_rate || 0) < 99 ? 'bg-status-warning' : 'bg-status-success'}
        loading={loading}
      />

      <StatCard
        title="Avg Response Time"
        value={formatResponseTime(stats?.avg_response_time_ms || 0)}
        icon={
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        color="bg-status-info"
        loading={loading}
      />

      <StatCard
        title="Modules"
        value={stats?.modules_count || 0}
        icon={
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
        color="bg-accent"
        loading={loading}
      />
    </div>
  )
}
