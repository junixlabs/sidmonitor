import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui'
import { formatLatency } from '@/utils/format'
import { getHealthChartColor, getSuccessRateBadgeColor } from '@/utils/styleHelpers'
import type { OutboundServiceHealth as ServiceHealthType } from '../../types'

interface OutboundServiceHealthProps {
  data?: ServiceHealthType[]
  loading?: boolean
  onServiceClick?: (serviceName: string) => void
}

export default function OutboundServiceHealth({ data = [], loading = false, onServiceClick }: OutboundServiceHealthProps) {
  if (loading) {
    return (
      <div className="bg-surface shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">Service Health</h3>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-surface-tertiary animate-pulse rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-surface shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">Service Health</h3>
        <EmptyState title="No service data available" />
      </div>
    )
  }

  const chartData = data.slice(0, 10).map((service) => ({
    name: service.service_name.length > 15
      ? service.service_name.substring(0, 15) + '...'
      : service.service_name,
    fullName: service.service_name,
    successRate: service.success_rate,
    avgLatency: service.avg_latency_ms,
    requests: service.total_requests,
    errors: service.failure_count || 0,
  }))

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-text-primary mb-4">Service Health</h3>

      {/* Success Rate Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-text-secondary mb-3">Success Rate by Service</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
              }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Success Rate']}
            />
            <Bar dataKey="successRate" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getHealthChartColor(entry.successRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Service List */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-text-secondary">Service Details</h4>
        {data.slice(0, 8).map((service) => (
          <div
            key={service.service_name}
            onClick={() => onServiceClick?.(service.service_name)}
            className={cn(
              'flex items-center justify-between py-3 px-4 bg-surface-secondary rounded-lg border border-border-subtle',
              onServiceClick && 'cursor-pointer hover:bg-surface-tertiary hover:border-border-primary transition-colors'
            )}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  getSuccessRateBadgeColor(service.success_rate)
                )}
              >
                {service.success_rate.toFixed(1)}%
              </span>
              <span className="text-sm font-medium text-text-primary truncate">
                {service.service_name}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm flex-shrink-0 ml-4">
              <div className="text-right">
                <p className="text-xs text-text-muted">Requests</p>
                <p className="font-medium text-text-primary">
                  {service.total_requests.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">Errors</p>
                <p className={cn(
                  'font-medium',
                  (service.failure_count || 0) > 0 ? 'text-status-danger' : 'text-status-success'
                )}>
                  {(service.failure_count || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">Avg Latency</p>
                <p className="font-medium text-text-secondary">
                  {formatLatency(service.avg_latency_ms)}
                </p>
              </div>
              {onServiceClick && (
                <div className="text-text-muted">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
