import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { PerformancePercentiles, SlowRequestsSummary, PerformanceTimelinePoint } from '../../types'
import { EmptyState } from '@/components/ui'
import { formatResponseTime } from '../../utils/format'

interface PerformanceMetricsProps {
  percentiles?: PerformancePercentiles
  slowRequests?: SlowRequestsSummary
  timeline?: PerformanceTimelinePoint[]
  loading?: boolean
}

interface PercentileCardProps {
  label: string
  value: number
  color: string
  loading?: boolean
}

function PercentileCard({ label, value, color, loading = false }: PercentileCardProps) {
  return (
    <div className="bg-surface rounded-lg border border-border-subtle p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-muted">{label}</p>
          {loading ? (
            <div className="h-8 w-20 bg-surface-tertiary animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-semibold text-text-primary mt-1">
              {formatResponseTime(value)}
            </p>
          )}
        </div>
        <div className={`h-12 w-12 rounded-full ${color} flex items-center justify-center`}>
          <span className="text-white font-semibold text-sm">{label.replace('p', 'P')}</span>
        </div>
      </div>
    </div>
  )
}

export default function PerformanceMetrics({
  percentiles,
  slowRequests,
  timeline,
  loading = false,
}: PerformanceMetricsProps) {
  const getTimeFormat = () => {
    if (!timeline || timeline.length === 0) return 'HH:mm'

    const firstDate = parseISO(timeline[0].timestamp)
    const lastDate = parseISO(timeline[timeline.length - 1].timestamp)
    const diffHours = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60)

    if (diffHours <= 2) return 'HH:mm'
    if (diffHours <= 48) return 'HH:mm'
    return 'MMM dd'
  }

  const timeFormat = getTimeFormat()

  const formattedTimeline = useMemo(() => {
    if (!timeline) return []
    return timeline.map((point) => ({
      ...point,
      time: format(parseISO(point.timestamp), timeFormat),
    }))
  }, [timeline, timeFormat])

  return (
    <div className="space-y-6">
      {/* Percentiles Section */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Response Time Percentiles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PercentileCard
            label="p50"
            value={percentiles?.p50 || 0}
            color="bg-status-success"
            loading={loading}
          />
          <PercentileCard
            label="p90"
            value={percentiles?.p90 || 0}
            color="bg-status-info"
            loading={loading}
          />
          <PercentileCard
            label="p95"
            value={percentiles?.p95 || 0}
            color="bg-status-warning"
            loading={loading}
          />
          <PercentileCard
            label="p99"
            value={percentiles?.p99 || 0}
            color="bg-status-danger"
            loading={loading}
          />
        </div>

        {/* Additional Stats */}
        {!loading && percentiles && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div className="bg-surface-secondary rounded-lg p-3 border border-border-subtle">
              <p className="text-xs font-medium text-text-muted">Min</p>
              <p className="text-lg font-semibold text-text-primary mt-1">
                {formatResponseTime(percentiles.min)}
              </p>
            </div>
            <div className="bg-surface-secondary rounded-lg p-3 border border-border-subtle">
              <p className="text-xs font-medium text-text-muted">Average</p>
              <p className="text-lg font-semibold text-text-primary mt-1">
                {formatResponseTime(percentiles.avg)}
              </p>
            </div>
            <div className="bg-surface-secondary rounded-lg p-3 border border-border-subtle">
              <p className="text-xs font-medium text-text-muted">Max</p>
              <p className="text-lg font-semibold text-text-primary mt-1">
                {formatResponseTime(percentiles.max)}
              </p>
            </div>
            <div className="bg-surface-secondary rounded-lg p-3 border border-border-subtle">
              <p className="text-xs font-medium text-text-muted">p75</p>
              <p className="text-lg font-semibold text-text-primary mt-1">
                {formatResponseTime(percentiles.p75)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Performance Timeline Chart */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Performance Over Time</h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-4 bg-surface-tertiary rounded w-32 mb-4" />
              <div className="h-48 bg-surface-tertiary rounded w-full" />
            </div>
          </div>
        ) : formattedTimeline.length === 0 ? (
          <EmptyState title="No performance data available" description="Try selecting a different time range." className="h-64" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={formattedTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                stroke="var(--text-muted)"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="var(--text-muted)"
                label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                }}
                formatter={(value: number) => `${value.toFixed(2)} ms`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="p50"
                name="P50 (Median)"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="avg"
                name="Average"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="p95"
                name="P95"
                stroke="#eab308"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="p99"
                name="P99"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Slow Requests Section */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Slow Requests Summary</h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-surface-tertiary animate-pulse rounded" />
            ))}
          </div>
        ) : slowRequests ? (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-border-subtle">
              <div>
                <p className="text-sm font-medium text-text-muted">Total Requests</p>
                <p className="text-2xl font-semibold text-text-primary mt-1">
                  {slowRequests.total_requests.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-text-muted">Slow Requests</p>
                <p className="text-2xl font-semibold text-status-warning mt-1">
                  {slowRequests.slow_count.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-text-muted">Slow Percentage</p>
                <p className={`text-2xl font-semibold mt-1 ${
                  slowRequests.slow_percentage < 5 ? 'text-status-success' :
                  slowRequests.slow_percentage < 10 ? 'text-status-warning' :
                  'text-status-danger'
                }`}>
                  {slowRequests.slow_percentage.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Slowest Endpoints */}
            {slowRequests.slowest_endpoints && slowRequests.slowest_endpoints.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-3">Slowest Endpoints</h3>
                <div className="space-y-2">
                  {slowRequests.slowest_endpoints.map((endpoint, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-3 px-4 bg-surface-secondary rounded-lg border border-border-subtle"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <span className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${
                          endpoint.method === 'GET' ? 'bg-status-success/10 text-status-success' :
                          endpoint.method === 'POST' ? 'bg-status-info/10 text-status-info' :
                          endpoint.method === 'PUT' ? 'bg-status-warning/10 text-status-warning' :
                          endpoint.method === 'DELETE' ? 'bg-status-danger/10 text-status-danger' :
                          'bg-surface-tertiary text-text-primary'
                        }`}>
                          {endpoint.method}
                        </span>
                        <span className="text-sm text-text-primary font-mono truncate">
                          {endpoint.endpoint}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm flex-shrink-0 ml-4">
                        <div className="text-right">
                          <p className="text-xs text-text-muted">Avg</p>
                          <p className="font-medium text-text-primary">
                            {formatResponseTime(endpoint.avg_response_time)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-text-muted">P95</p>
                          <p className="font-medium text-status-warning">
                            {formatResponseTime(endpoint.p95_response_time)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-text-muted">Requests</p>
                          <p className="font-medium text-text-secondary">
                            {endpoint.request_count.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="No slow request data available" />
        )}
      </div>
    </div>
  )
}
