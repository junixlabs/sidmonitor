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
import { useTrafficByMethod, usePeakHours, useTrafficByDay, useThroughput } from '../../hooks/useLogs'
import { formatNumber, formatResponseTime, formatPercentage } from '../../utils/format'
import { EmptyState } from '@/components/ui'
import type { DashboardTab } from '../../types'

interface TrafficPatternsProps {
  activeTab?: DashboardTab
}

const HTTP_METHOD_COLORS: Record<string, string> = {
  GET: '#10b981',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#8b5cf6',
  DELETE: '#ef4444',
  OPTIONS: '#6b7280',
  HEAD: '#ec4899',
}

export default function TrafficPatterns({ activeTab = 'all' }: TrafficPatternsProps) {
  const { data: trafficByMethod, isLoading: methodLoading } = useTrafficByMethod(activeTab)
  const { data: peakHours, isLoading: peakHoursLoading } = usePeakHours(activeTab)
  const { data: trafficByDay, isLoading: dayLoading } = useTrafficByDay(activeTab)
  const { data: throughput, isLoading: throughputLoading } = useThroughput(activeTab)

  return (
    <div className="space-y-6">
      {/* Throughput Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface shadow rounded-lg p-6">
          <div className="text-sm font-medium text-text-muted mb-1">Avg Requests/Minute</div>
          {throughputLoading ? (
            <div className="h-8 bg-surface-tertiary animate-pulse rounded w-24" />
          ) : (
            <div className="text-2xl font-semibold text-text-primary">
              {formatNumber(throughput?.avg_requests_per_minute)}
            </div>
          )}
        </div>

        <div className="bg-surface shadow rounded-lg p-6">
          <div className="text-sm font-medium text-text-muted mb-1">Peak Requests/Minute</div>
          {throughputLoading ? (
            <div className="h-8 bg-surface-tertiary animate-pulse rounded w-24" />
          ) : (
            <div className="text-2xl font-semibold text-text-primary">
              {formatNumber(throughput?.peak_requests_per_minute)}
            </div>
          )}
        </div>

        <div className="bg-surface shadow rounded-lg p-6">
          <div className="text-sm font-medium text-text-muted mb-1">Avg Requests/Second</div>
          {throughputLoading ? (
            <div className="h-8 bg-surface-tertiary animate-pulse rounded w-24" />
          ) : (
            <div className="text-2xl font-semibold text-text-primary">
              {throughput?.avg_requests_per_second?.toFixed(2) || '-'}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HTTP Methods Distribution */}
        <div className="bg-surface shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Traffic by HTTP Method</h2>
          {methodLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse flex flex-col items-center w-full">
                <div className="h-48 bg-surface-tertiary rounded w-full" />
              </div>
            </div>
          ) : trafficByMethod && trafficByMethod.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trafficByMethod}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="method" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number) => formatNumber(value)}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {trafficByMethod.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={HTTP_METHOD_COLORS[entry.method] || '#6b7280'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Method Details Table */}
              <div className="mt-4 space-y-2">
                {trafficByMethod.map((method, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: HTTP_METHOD_COLORS[method.method] || '#6b7280' }}
                      />
                      <span className="text-sm font-medium text-text-primary">{method.method}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-text-muted">{formatNumber(method.count)}</span>
                      <span className="text-text-muted">|</span>
                      <span className="text-text-muted">{formatPercentage(method.percentage)}</span>
                      <span className="text-text-muted">|</span>
                      <span className="text-text-muted">{formatResponseTime(method.avg_response_time)}</span>
                      <span className="text-text-muted">|</span>
                      <span
                        className={`font-medium ${
                          method.error_rate < 5
                            ? 'text-status-success'
                            : method.error_rate <= 20
                            ? 'text-status-warning'
                            : 'text-status-danger'
                        }`}
                      >
                        {method.error_rate.toFixed(1)}% err
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No HTTP method data available" className="h-64" />
          )}
        </div>

        {/* Traffic by Day of Week */}
        <div className="bg-surface shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Traffic by Day of Week</h2>
          {dayLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse flex flex-col items-center w-full">
                <div className="h-48 bg-surface-tertiary rounded w-full" />
              </div>
            </div>
          ) : trafficByDay && trafficByDay.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trafficByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day_name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number) => formatNumber(value)}
                  />
                  <Bar dataKey="avg_requests" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg Requests" />
                </BarChart>
              </ResponsiveContainer>

              {/* Day Details */}
              <div className="mt-4 space-y-2">
                {trafficByDay.map((day, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
                  >
                    <span className="text-sm font-medium text-text-primary">{day.day_name}</span>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-text-muted">
                        Avg: {formatNumber(day.avg_requests)}
                      </span>
                      <span className="text-text-muted">|</span>
                      <span className="text-text-muted">
                        Peak: {formatNumber(day.peak_requests)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No day-of-week data available" className="h-64" />
          )}
        </div>
      </div>

      {/* Peak Hours Heatmap */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Peak Hours (24-Hour View)</h2>
        {peakHoursLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center w-full">
              <div className="h-48 bg-surface-tertiary rounded w-full" />
            </div>
          </div>
        ) : peakHours && peakHours.length > 0 ? (
          <>
            {/* Heatmap Grid */}
            <div className="grid grid-cols-12 gap-2 mb-4">
              {peakHours.map((hourData, index) => {
                const maxRequests = Math.max(...peakHours.map((h) => h.peak_requests))
                const intensity = maxRequests > 0 ? (hourData.peak_requests / maxRequests) * 100 : 0

                return (
                  <div
                    key={index}
                    className="relative group aspect-square rounded flex flex-col items-center justify-center text-xs transition-all hover:scale-110 cursor-pointer"
                    style={{
                      backgroundColor: intensity > 0
                        ? `rgba(99, 102, 241, ${0.1 + (intensity / 100) * 0.9})`
                        : '#f3f4f6',
                    }}
                  >
                    <div className="font-medium text-text-secondary">{hourData.hour}h</div>

                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap">
                      <div className="font-medium">{hourData.hour}:00 - {hourData.hour}:59</div>
                      <div>Avg: {formatNumber(hourData.avg_requests)} req</div>
                      <div>Peak: {formatNumber(hourData.peak_requests)} req</div>
                      <div>Response: {formatResponseTime(hourData.avg_response_time)}</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <div className="flex items-center space-x-2">
                <span>Activity:</span>
                <div className="flex items-center space-x-1">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }} />
                  <span>Low</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: 'rgba(99, 102, 241, 0.5)' }} />
                  <span>Medium</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: 'rgba(99, 102, 241, 1)' }} />
                  <span>High</span>
                </div>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-text-primary mb-3">Hourly Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {peakHours.map((hourData, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 bg-surface-secondary rounded text-sm"
                  >
                    <span className="font-medium text-text-primary">{hourData.hour}:00</span>
                    <div className="flex items-center space-x-3 text-xs">
                      <span className="text-text-secondary">
                        {formatNumber(hourData.avg_requests)}
                      </span>
                      <span className="text-text-muted">|</span>
                      <span className="text-accent font-medium">
                        ↑ {formatNumber(hourData.peak_requests)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="No peak hours data available" className="h-64" />
        )}
      </div>
    </div>
  )
}
