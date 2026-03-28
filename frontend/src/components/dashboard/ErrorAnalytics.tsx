import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { useErrorBreakdown, useErrorEndpoints, useErrorTimeline } from '../../hooks/useLogs'
import { EmptyState } from '@/components/ui'
import type { DashboardTab, TimeSeriesParams } from '../../types'

interface ErrorAnalyticsProps {
  type?: DashboardTab
  timeRange?: TimeSeriesParams
}

const COLORS = {
  client: '#f59e0b', // amber-500
  server: '#ef4444', // red-500
}

export default function ErrorAnalytics({ type = 'all', timeRange }: ErrorAnalyticsProps) {
  // Fetch error breakdown
  const { data: errorBreakdown, isLoading: breakdownLoading } = useErrorBreakdown(type)

  // Fetch error endpoints
  const { data: errorEndpoints, isLoading: endpointsLoading } = useErrorEndpoints(10, type)

  // Fetch error timeline
  const { data: errorTimeline, isLoading: timelineLoading } = useErrorTimeline(timeRange, type)

  // Prepare pie chart data
  const pieData = useMemo(() => {
    if (!errorBreakdown) return []
    return [
      {
        name: '4xx Client Errors',
        value: errorBreakdown.client_errors_4xx.count,
        percentage: errorBreakdown.client_errors_4xx.percentage,
      },
      {
        name: '5xx Server Errors',
        value: errorBreakdown.server_errors_5xx.count,
        percentage: errorBreakdown.server_errors_5xx.percentage,
      },
    ].filter((item) => item.value > 0)
  }, [errorBreakdown])

  // Format timeline data
  const formattedTimeline = useMemo(() => {
    if (!errorTimeline) return []
    return errorTimeline.map((point) => ({
      ...point,
      time: format(parseISO(point.timestamp), 'HH:mm'),
    }))
  }, [errorTimeline])

  return (
    <div className="space-y-6">
      {/* Error Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-surface shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Error Distribution</h2>
          {breakdownLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse">
                <div className="h-48 w-48 bg-surface-tertiary rounded-full" />
              </div>
            </div>
          ) : errorBreakdown && errorBreakdown.total_errors > 0 ? (
            <div>
              <div className="flex items-center justify-center mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-text-primary">
                    {errorBreakdown.total_errors.toLocaleString()}
                  </div>
                  <div className="text-sm text-text-muted">Total Errors</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={256}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percentage }) => `${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? COLORS.client : COLORS.server}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => value.toLocaleString()}
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No error data available" className="h-64" />
          )}
        </div>

        {/* Status Code Breakdown */}
        <div className="bg-surface shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Status Code Breakdown</h2>
          {breakdownLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-tertiary animate-pulse rounded" />
              ))}
            </div>
          ) : errorBreakdown && errorBreakdown.by_status_code.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {errorBreakdown.by_status_code.map((statusCode, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        statusCode.status_code >= 500
                          ? 'bg-status-danger/10 text-status-danger'
                          : 'bg-status-warning/10 text-status-warning'
                      }`}
                    >
                      {statusCode.status_code}
                    </span>
                    <span className="text-sm text-text-secondary">{statusCode.description}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-text-primary">
                        {statusCode.count.toLocaleString()}
                      </div>
                      <div className="text-xs text-text-muted">
                        {statusCode.percentage.toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-24 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          statusCode.status_code >= 500 ? 'bg-status-danger' : 'bg-status-warning'
                        }`}
                        style={{ width: `${statusCode.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No status code data available" />
          )}
        </div>
      </div>

      {/* Top Error Endpoints */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Top Error Endpoints</h2>
        {endpointsLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-tertiary animate-pulse rounded" />
            ))}
          </div>
        ) : errorEndpoints && errorEndpoints.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    Errors
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    Error Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Top Errors
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border-subtle">
                {errorEndpoints.map((endpoint, index) => (
                  <tr key={index} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-text-primary truncate max-w-xs block">
                        {endpoint.endpoint}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          endpoint.method === 'GET'
                            ? 'bg-status-success/10 text-status-success'
                            : endpoint.method === 'POST'
                            ? 'bg-status-info/10 text-status-info'
                            : endpoint.method === 'PUT'
                            ? 'bg-status-warning/10 text-status-warning'
                            : endpoint.method === 'DELETE'
                            ? 'bg-status-danger/10 text-status-danger'
                            : 'bg-surface-tertiary text-text-primary'
                        }`}
                      >
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-text-primary">
                      {endpoint.total_requests.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-status-danger">
                      {endpoint.error_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span
                        className={`text-sm font-medium ${
                          endpoint.error_rate < 5
                            ? 'text-status-success'
                            : endpoint.error_rate <= 20
                            ? 'text-status-warning'
                            : 'text-status-danger'
                        }`}
                      >
                        {endpoint.error_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {endpoint.top_errors.slice(0, 3).map((error, i) => (
                          <span
                            key={i}
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              error.status_code >= 500
                                ? 'bg-status-danger/10 text-status-danger'
                                : 'bg-status-warning/10 text-status-warning'
                            }`}
                          >
                            {error.status_code} ({error.count})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No error endpoints data available" />
        )}
      </div>

      {/* Error Timeline */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Error Timeline</h2>
        {timelineLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-4 bg-surface-tertiary rounded w-32 mb-4" />
              <div className="h-48 bg-surface-tertiary rounded w-full" />
            </div>
          </div>
        ) : formattedTimeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={formattedTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="total_errors"
                name="Total Errors"
                stroke="#6b7280"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="errors_4xx"
                name="4xx Errors"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="errors_5xx"
                name="5xx Errors"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No timeline data available" description="Try selecting a different time range." className="h-64" />
        )}
      </div>
    </div>
  )
}
