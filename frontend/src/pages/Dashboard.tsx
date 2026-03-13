import { useSearchParams, Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { ArrowDown, ArrowUp, RefreshCw, ChevronRight, XCircle, Check } from 'lucide-react'
import StatsCard from '../components/dashboard/StatsCard'
import RequestsChart from '../components/dashboard/RequestsChart'
import { ErrorAlert } from '@/components/ui'
import { useStats, useTimeSeries } from '../hooks/useLogs'
import { useInboundStats, useInboundModuleHealth } from '../hooks/useInboundLogs'
import { useOutboundStats, useOutboundServiceHealth } from '../hooks/useOutboundLogs'
import { useJobStats } from '../hooks/useJobs'
import { useProjectUrl } from '../hooks/useProjectUrl'
import { formatNumber, formatPercentage, formatResponseTime } from '../utils/format'

type TimeRange = '1h' | '6h' | '24h' | '7d'

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [dismissedAlert, setDismissedAlert] = useState(false)
  const projectUrl = useProjectUrl()

  // Get time range from URL, default to '24h'
  const timeRange = (searchParams.get('range') as TimeRange) || '24h'

  // Memoize start_date to prevent infinite re-renders
  const startDate = useMemo(() => {
    const now = new Date()
    const start = new Date(now)

    switch (timeRange) {
      case '1h':
        start.setHours(now.getHours() - 1)
        break
      case '6h':
        start.setHours(now.getHours() - 6)
        break
      case '24h':
        start.setHours(now.getHours() - 24)
        break
      case '7d':
        start.setDate(now.getDate() - 7)
        break
    }

    return start.toISOString()
  }, [timeRange])

  // Fetch overall stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useStats('all', startDate)
  const { data: timeSeries, isLoading: timeSeriesLoading } = useTimeSeries({ start_date: startDate }, 'all')

  // Health cards data
  const { data: inboundStats, isLoading: inboundStatsLoading } = useInboundStats()
  const { data: inboundModuleHealth, isLoading: inboundModuleHealthLoading } = useInboundModuleHealth()
  const { data: outboundStats, isLoading: outboundStatsLoading } = useOutboundStats()
  const { data: outboundServiceHealth, isLoading: outboundServiceHealthLoading } = useOutboundServiceHealth()
  const { data: jobStats, isLoading: jobStatsLoading } = useJobStats('24h')

  // Handle time range change with URL persistence
  const handleTimeRangeChange = (range: TimeRange) => {
    if (range === '24h') {
      searchParams.delete('range')
    } else {
      searchParams.set('range', range)
    }
    setSearchParams(searchParams)
  }

  // Calculate error rate severity
  const getErrorRateSeverity = (errorRate: number | undefined): 'critical' | 'warning' | 'normal' | undefined => {
    if (errorRate === undefined) return undefined
    if (errorRate > 50) return 'critical'
    if (errorRate > 20) return 'warning'
    return 'normal'
  }

  // Get health indicator color based on success rate
  const getHealthColor = (successRate: number): { bg: string; text: string; dot: string } => {
    if (successRate >= 99) return { bg: 'bg-status-success/10', text: 'text-status-success', dot: 'bg-status-success' }
    if (successRate >= 95) return { bg: 'bg-status-warning/10', text: 'text-status-warning', dot: 'bg-status-warning' }
    return { bg: 'bg-status-danger/10', text: 'text-status-danger', dot: 'bg-status-danger' }
  }

  const errorRateSeverity = getErrorRateSeverity(stats?.error_rate)
  const showCriticalAlert = !dismissedAlert && errorRateSeverity === 'critical' && stats?.error_rate !== undefined

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Project Dashboard</h1>

      {statsError && (
        <ErrorAlert message="Failed to load dashboard stats" description="Please check your connection." className="mb-4" />
      )}

      {showCriticalAlert && (
        <div className="mb-4 bg-status-danger/10 border-l-4 border-status-danger p-4 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-status-danger" />
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-status-danger">
                <span className="font-medium">Critical Error Rate Alert!</span> Your current error rate is {stats?.error_rate.toFixed(2)}%, which exceeds the critical threshold of 50%. Please investigate immediately.
              </p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={() => setDismissedAlert(true)}
                className="inline-flex rounded-md bg-status-danger/10 p-1.5 text-status-danger hover:bg-status-danger/20 focus:outline-none focus:ring-2 focus:ring-status-danger focus:ring-offset-2"
              >
                <span className="sr-only">Dismiss</span>
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Requests"
          value={formatNumber(stats?.total_requests)}
          color="indigo"
          loading={statsLoading}
          trend={stats?.total_requests_trend}
        />
        <StatsCard
          title="Error Rate"
          value={formatPercentage(stats?.error_rate)}
          color="red"
          loading={statsLoading}
          severity={errorRateSeverity}
          trend={stats?.error_rate_trend}
        />
        <StatsCard
          title="Avg Response Time"
          value={formatResponseTime(stats?.avg_response_time)}
          color="yellow"
          loading={statsLoading}
          trend={stats?.avg_response_time_trend}
        />
        <StatsCard
          title="Requests/min"
          value={formatNumber(stats?.requests_per_minute)}
          color="green"
          loading={statsLoading}
          trend={stats?.requests_per_minute_trend}
        />
      </div>

      {/* Health Overview Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Inbound Health Card */}
        <Link to={projectUrl('inbound-apis')} className="bg-surface shadow rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
              <ArrowDown className="w-5 h-5 text-status-info" />
              Inbound APIs
            </h3>
            <ChevronRight className="w-5 h-5 text-text-muted" />
          </div>

          {inboundStatsLoading ? (
            <div className="space-y-3">
              <div className="h-6 bg-surface-tertiary animate-pulse rounded w-1/2" />
              <div className="h-4 bg-surface-tertiary animate-pulse rounded w-3/4" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 bg-surface-secondary rounded">
                  <div className="text-lg font-semibold text-text-primary">{formatNumber(inboundStats?.total_requests)}</div>
                  <div className="text-xs text-text-muted">Total</div>
                </div>
                <div className="text-center p-2 bg-surface-secondary rounded">
                  <div className={`text-lg font-semibold ${(inboundStats?.success_rate ?? 0) >= 95 ? 'text-status-success' : (inboundStats?.success_rate ?? 0) >= 90 ? 'text-status-warning' : 'text-status-danger'}`}>
                    {formatPercentage(inboundStats?.success_rate)}
                  </div>
                  <div className="text-xs text-text-muted">Success</div>
                </div>
                <div className="text-center p-2 bg-surface-secondary rounded">
                  <div className="text-lg font-semibold text-text-primary">{formatResponseTime(inboundStats?.avg_response_time_ms)}</div>
                  <div className="text-xs text-text-muted">Avg Time</div>
                </div>
              </div>

              {/* Top 3 Modules Preview */}
              {!inboundModuleHealthLoading && inboundModuleHealth && inboundModuleHealth.length > 0 && (
                <div className="space-y-1.5">
                  {inboundModuleHealth.slice(0, 3).map((module, idx) => {
                    const colors = getHealthColor(module.success_rate)
                    return (
                      <div key={idx} className="flex items-center justify-between py-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <span className="text-text-secondary truncate max-w-[100px]">{module.module}</span>
                        </div>
                        <span className={`text-xs font-medium ${colors.text}`}>
                          {module.success_rate.toFixed(1)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </Link>

        {/* Outbound Health Card */}
        <Link to={projectUrl('outbound-apis')} className="bg-surface shadow rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-accent" />
              Outbound APIs
            </h3>
            <ChevronRight className="w-5 h-5 text-text-muted" />
          </div>

          {outboundStatsLoading ? (
            <div className="space-y-3">
              <div className="h-6 bg-surface-tertiary animate-pulse rounded w-1/2" />
              <div className="h-4 bg-surface-tertiary animate-pulse rounded w-3/4" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 bg-surface-secondary rounded">
                  <div className="text-lg font-semibold text-text-primary">{formatNumber(outboundStats?.total_requests)}</div>
                  <div className="text-xs text-text-muted">Total</div>
                </div>
                <div className="text-center p-2 bg-surface-secondary rounded">
                  <div className={`text-lg font-semibold ${(outboundStats?.success_rate ?? 100) >= 95 ? 'text-status-success' : (outboundStats?.success_rate ?? 100) >= 90 ? 'text-status-warning' : 'text-status-danger'}`}>
                    {formatPercentage(outboundStats?.success_rate ?? 0)}
                  </div>
                  <div className="text-xs text-text-muted">Success</div>
                </div>
                <div className="text-center p-2 bg-surface-secondary rounded">
                  <div className="text-lg font-semibold text-text-primary">{formatResponseTime(outboundStats?.avg_latency_ms)}</div>
                  <div className="text-xs text-text-muted">Avg Latency</div>
                </div>
              </div>

              {/* Top 3 Services Preview */}
              {!outboundServiceHealthLoading && outboundServiceHealth && outboundServiceHealth.length > 0 && (
                <div className="space-y-1.5">
                  {outboundServiceHealth.slice(0, 3).map((service, idx) => {
                    const colors = getHealthColor(service.success_rate)
                    return (
                      <div key={idx} className="flex items-center justify-between py-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <span className="text-text-secondary truncate max-w-[100px]">{service.service_name}</span>
                        </div>
                        <span className={`text-xs font-medium ${colors.text}`}>
                          {service.success_rate.toFixed(1)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </Link>

        {/* Jobs Health Card */}
        <Link to={projectUrl('jobs')} className="bg-surface shadow rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-status-warning" />
              Background Jobs
            </h3>
            <ChevronRight className="w-5 h-5 text-text-muted" />
          </div>

          {jobStatsLoading ? (
            <div className="space-y-3">
              <div className="h-6 bg-surface-tertiary animate-pulse rounded w-1/2" />
              <div className="h-4 bg-surface-tertiary animate-pulse rounded w-3/4" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 bg-surface-secondary rounded">
                  <div className="text-lg font-semibold text-text-primary">{formatNumber(jobStats?.total_executions)}</div>
                  <div className="text-xs text-text-muted">Executions</div>
                </div>
                <div className="text-center p-2 bg-surface-secondary rounded">
                  <div className={`text-lg font-semibold ${(jobStats?.success_rate ?? 0) >= 95 ? 'text-status-success' : (jobStats?.success_rate ?? 0) >= 90 ? 'text-status-warning' : 'text-status-danger'}`}>
                    {formatPercentage(jobStats?.success_rate)}
                  </div>
                  <div className="text-xs text-text-muted">Success</div>
                </div>
                <div className="text-center p-2 bg-surface-secondary rounded">
                  <div className={`text-lg font-semibold ${(jobStats?.failure_count ?? 0) > 0 ? 'text-status-danger' : 'text-status-success'}`}>
                    {formatNumber(jobStats?.failure_count)}
                  </div>
                  <div className="text-xs text-text-muted">Failed</div>
                </div>
              </div>

              {/* Recent Failures Preview */}
              {jobStats?.recent_failures && jobStats.recent_failures.length > 0 ? (
                <div className="space-y-1.5">
                  {jobStats.recent_failures.slice(0, 3).map((job, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-status-danger" />
                        <span className="text-text-secondary truncate max-w-[100px]">{job.job_class}</span>
                      </div>
                      <span className="text-xs text-text-muted">
                        {new Date(job.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-status-success text-center py-2 flex items-center justify-center gap-1">
                  <Check className="w-4 h-4" />
                  No recent failures
                </div>
              )}
            </>
          )}
        </Link>
      </div>

      {/* Request Statistics Chart */}
      <div className="mt-8">
        <div className="bg-surface shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">Request Statistics</h2>
            <div className="flex space-x-1 bg-surface-tertiary p-1 rounded-lg">
              {(['1h', '6h', '24h', '7d'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => handleTimeRangeChange(range)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    timeRange === range
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <RequestsChart data={timeSeries || []} loading={timeSeriesLoading} />
        </div>
      </div>
    </div>
  )
}
