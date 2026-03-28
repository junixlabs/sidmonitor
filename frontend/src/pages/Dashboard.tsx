import { useSearchParams, Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, RefreshCw, ChevronRight, XCircle, Check, Activity, AlertTriangle, Clock, Zap } from 'lucide-react'
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

  const timeRange = (searchParams.get('range') as TimeRange) || '24h'

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

  const handleTimeRangeChange = (range: TimeRange) => {
    if (range === '24h') {
      searchParams.delete('range')
    } else {
      searchParams.set('range', range)
    }
    setSearchParams(searchParams)
  }

  const getErrorRateSeverity = (errorRate: number | undefined): 'critical' | 'warning' | 'normal' | undefined => {
    if (errorRate === undefined) return undefined
    if (errorRate > 50) return 'critical'
    if (errorRate > 20) return 'warning'
    return 'normal'
  }

  const getHealthColor = (successRate: number): { bg: string; text: string; dot: string } => {
    if (successRate >= 99) return { bg: 'bg-status-success/10', text: 'text-status-success', dot: 'bg-status-success' }
    if (successRate >= 95) return { bg: 'bg-status-warning/10', text: 'text-status-warning', dot: 'bg-status-warning' }
    return { bg: 'bg-status-danger/10', text: 'text-status-danger', dot: 'bg-status-danger' }
  }

  const errorRateSeverity = getErrorRateSeverity(stats?.error_rate)
  const showCriticalAlert = !dismissedAlert && errorRateSeverity === 'critical' && stats?.error_rate !== undefined

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">Monitor your application health and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-tertiary/50 p-0.5 rounded-lg border border-border-subtle">
            {(['1h', '6h', '24h', '7d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  timeRange === range
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {statsError && (
        <ErrorAlert message="Failed to load dashboard stats" description="Please check your connection." className="mb-4" />
      )}

      {showCriticalAlert && (
        <div className="mb-6 bg-status-danger/10 border border-status-danger/20 p-4 rounded-xl">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-status-danger flex-shrink-0 mt-0.5" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-status-danger">Critical Error Rate Alert</p>
              <p className="text-sm text-text-secondary mt-0.5">
                Error rate is at {stats?.error_rate.toFixed(2)}%, exceeding the critical threshold of 50%.
              </p>
            </div>
            <button
              onClick={() => setDismissedAlert(true)}
              className="p-1 rounded-md hover:bg-status-danger/20 transition-colors"
            >
              <XCircle className="h-4 w-4 text-status-danger" />
            </button>
          </div>
        </div>
      )}

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Requests"
          value={formatNumber(stats?.total_requests)}
          icon={<Activity className="w-4 h-4" />}
          color="indigo"
          loading={statsLoading}
          trend={stats?.total_requests_trend}
        />
        <StatsCard
          title="Error Rate"
          value={formatPercentage(stats?.error_rate)}
          icon={<AlertTriangle className="w-4 h-4" />}
          color="red"
          loading={statsLoading}
          severity={errorRateSeverity}
          trend={stats?.error_rate_trend}
        />
        <StatsCard
          title="Avg Response Time"
          value={formatResponseTime(stats?.avg_response_time)}
          icon={<Clock className="w-4 h-4" />}
          color="yellow"
          loading={statsLoading}
          trend={stats?.avg_response_time_trend}
        />
        <StatsCard
          title="Requests/min"
          value={formatNumber(stats?.requests_per_minute)}
          icon={<Zap className="w-4 h-4" />}
          color="green"
          loading={statsLoading}
          trend={stats?.requests_per_minute_trend}
        />
      </div>

      {/* Health Overview Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Inbound Health Card */}
        <Link
          to={projectUrl('inbound-apis')}
          className="bg-surface rounded-xl border border-border-subtle p-5 hover:border-border-primary transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-status-info" />
              Inbound APIs
            </h3>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
          </div>

          {inboundStatsLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="h-14 bg-surface-tertiary/50 animate-pulse rounded-lg" />
                <div className="h-14 bg-surface-tertiary/50 animate-pulse rounded-lg" />
                <div className="h-14 bg-surface-tertiary/50 animate-pulse rounded-lg" />
              </div>
              <div className="h-4 bg-surface-tertiary/50 animate-pulse rounded w-3/4" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2.5 bg-surface-secondary rounded-lg">
                  <div className="text-lg font-bold text-text-primary">{formatNumber(inboundStats?.total_requests)}</div>
                  <div className="text-[11px] text-text-muted">Total</div>
                </div>
                <div className="text-center p-2.5 bg-surface-secondary rounded-lg">
                  <div className={`text-lg font-bold ${(inboundStats?.success_rate ?? 0) >= 95 ? 'text-status-success' : (inboundStats?.success_rate ?? 0) >= 90 ? 'text-status-warning' : 'text-status-danger'}`}>
                    {formatPercentage(inboundStats?.success_rate)}
                  </div>
                  <div className="text-[11px] text-text-muted">Success</div>
                </div>
                <div className="text-center p-2.5 bg-surface-secondary rounded-lg">
                  <div className="text-lg font-bold text-text-primary">{formatResponseTime(inboundStats?.avg_response_time_ms)}</div>
                  <div className="text-[11px] text-text-muted">Avg Time</div>
                </div>
              </div>

              {!inboundModuleHealthLoading && inboundModuleHealth && inboundModuleHealth.length > 0 && (
                <div className="space-y-1.5 border-t border-border-subtle pt-3">
                  {inboundModuleHealth.slice(0, 3).map((module, idx) => {
                    const colors = getHealthColor(module.success_rate)
                    return (
                      <div key={idx} className="flex items-center justify-between py-0.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          <span className="text-text-secondary truncate max-w-[120px] text-xs">{module.module}</span>
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
        <Link
          to={projectUrl('outbound-apis')}
          className="bg-surface rounded-xl border border-border-subtle p-5 hover:border-border-primary transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-accent" />
              Outbound APIs
            </h3>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
          </div>

          {outboundStatsLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="h-14 bg-surface-tertiary/50 animate-pulse rounded-lg" />
                <div className="h-14 bg-surface-tertiary/50 animate-pulse rounded-lg" />
                <div className="h-14 bg-surface-tertiary/50 animate-pulse rounded-lg" />
              </div>
              <div className="h-4 bg-surface-tertiary/50 animate-pulse rounded w-3/4" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2.5 bg-surface-secondary rounded-lg">
                  <div className="text-lg font-bold text-text-primary">{formatNumber(outboundStats?.total_requests)}</div>
                  <div className="text-[11px] text-text-muted">Total</div>
                </div>
                <div className="text-center p-2.5 bg-surface-secondary rounded-lg">
                  <div className={`text-lg font-bold ${(outboundStats?.success_rate ?? 100) >= 95 ? 'text-status-success' : (outboundStats?.success_rate ?? 100) >= 90 ? 'text-status-warning' : 'text-status-danger'}`}>
                    {formatPercentage(outboundStats?.success_rate ?? 0)}
                  </div>
                  <div className="text-[11px] text-text-muted">Success</div>
                </div>
                <div className="text-center p-2.5 bg-surface-secondary rounded-lg">
                  <div className="text-lg font-bold text-text-primary">{formatResponseTime(outboundStats?.avg_latency_ms)}</div>
                  <div className="text-[11px] text-text-muted">Avg Latency</div>
                </div>
              </div>

              {!outboundServiceHealthLoading && outboundServiceHealth && outboundServiceHealth.length > 0 && (
                <div className="space-y-1.5 border-t border-border-subtle pt-3">
                  {outboundServiceHealth.slice(0, 3).map((service, idx) => {
                    const colors = getHealthColor(service.success_rate)
                    return (
                      <div key={idx} className="flex items-center justify-between py-0.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          <span className="text-text-secondary truncate max-w-[120px] text-xs">{service.service_name}</span>
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
        <Link
          to={projectUrl('jobs')}
          className="bg-surface rounded-xl border border-border-subtle p-5 hover:border-border-primary transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-status-warning" />
              Background Jobs
            </h3>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
          </div>

          {jobStatsLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="h-14 bg-surface-tertiary/50 animate-pulse rounded-lg" />
                <div className="h-14 bg-surface-tertiary/50 animate-pulse rounded-lg" />
                <div className="h-14 bg-surface-tertiary/50 animate-pulse rounded-lg" />
              </div>
              <div className="h-4 bg-surface-tertiary/50 animate-pulse rounded w-3/4" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2.5 bg-surface-secondary rounded-lg">
                  <div className="text-lg font-bold text-text-primary">{formatNumber(jobStats?.total_executions)}</div>
                  <div className="text-[11px] text-text-muted">Executions</div>
                </div>
                <div className="text-center p-2.5 bg-surface-secondary rounded-lg">
                  <div className={`text-lg font-bold ${(jobStats?.success_rate ?? 0) >= 95 ? 'text-status-success' : (jobStats?.success_rate ?? 0) >= 90 ? 'text-status-warning' : 'text-status-danger'}`}>
                    {formatPercentage(jobStats?.success_rate)}
                  </div>
                  <div className="text-[11px] text-text-muted">Success</div>
                </div>
                <div className="text-center p-2.5 bg-surface-secondary rounded-lg">
                  <div className={`text-lg font-bold ${(jobStats?.failure_count ?? 0) > 0 ? 'text-status-danger' : 'text-status-success'}`}>
                    {formatNumber(jobStats?.failure_count)}
                  </div>
                  <div className="text-[11px] text-text-muted">Failed</div>
                </div>
              </div>

              {jobStats?.recent_failures && jobStats.recent_failures.length > 0 ? (
                <div className="space-y-1.5 border-t border-border-subtle pt-3">
                  {jobStats.recent_failures.slice(0, 3).map((job, idx) => (
                    <div key={idx} className="flex items-center justify-between py-0.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-danger" />
                        <span className="text-text-secondary truncate max-w-[120px] text-xs">{job.job_class}</span>
                      </div>
                      <span className="text-xs text-text-muted">
                        {new Date(job.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-status-success text-center py-2 flex items-center justify-center gap-1 border-t border-border-subtle mt-1 pt-3">
                  <Check className="w-3.5 h-3.5" />
                  No recent failures
                </div>
              )}
            </>
          )}
        </Link>
      </div>

      {/* Request Statistics Chart */}
      <div className="mt-6">
        <div className="bg-surface rounded-xl border border-border-subtle p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-text-primary">Request Statistics</h2>
          </div>
          <RequestsChart data={timeSeries || []} loading={timeSeriesLoading} />
        </div>
      </div>
    </div>
  )
}
