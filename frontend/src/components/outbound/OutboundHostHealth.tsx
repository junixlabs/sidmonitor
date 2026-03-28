import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui'
import { formatLatency } from '@/utils/format'
import { getSuccessRateBadgeColor } from '@/utils/styleHelpers'
import type { OutboundHostHealth as HostHealthType } from '../../types'

interface OutboundHostHealthProps {
  data?: HostHealthType[]
  loading?: boolean
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb923c', '#facc15']

export default function OutboundHostHealth({ data = [], loading = false }: OutboundHostHealthProps) {
  if (loading) {
    return (
      <div className="bg-surface shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">Target Hosts</h3>
        <div className="space-y-4">
          <div className="h-48 bg-surface-tertiary animate-pulse rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-tertiary animate-pulse rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-surface shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">Target Hosts</h3>
        <EmptyState title="No host data available" />
      </div>
    )
  }

  const pieData = data.slice(0, 8).map((host, index) => ({
    name: host.target_host.length > 20
      ? host.target_host.substring(0, 20) + '...'
      : host.target_host,
    fullName: host.target_host,
    value: host.total_requests,
    successRate: host.success_rate,
    avgLatency: host.avg_latency_ms,
    errors: host.failure_count || 0,
    color: COLORS[index % COLORS.length],
  }))

  const totalRequests = data.reduce((sum, host) => sum + host.total_requests, 0)

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-text-primary mb-4">Target Hosts</h3>

      {/* Pie Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
              }}
              formatter={(value: number) => [
                `${value.toLocaleString()} requests (${((value / totalRequests) * 100).toFixed(1)}%)`,
                'Host'
              ]}
            />
            <Legend
              formatter={(value) => <span className="text-xs text-text-secondary">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Host List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-text-secondary mb-3">Host Details</h4>
        {data.slice(0, 6).map((host, index) => (
          <div
            key={host.target_host}
            className="flex items-center justify-between py-2 px-3 hover:bg-surface-secondary rounded-lg transition-colors"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-sm text-text-primary truncate" title={host.target_host}>
                {host.target_host}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-sm flex-shrink-0 ml-4">
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  getSuccessRateBadgeColor(host.success_rate)
                )}
              >
                {host.success_rate.toFixed(1)}%
              </span>
              <span className="text-text-muted w-16 text-right">
                {host.total_requests.toLocaleString()}
              </span>
              <span className="text-text-muted w-16 text-right">
                {formatLatency(host.avg_latency_ms)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
