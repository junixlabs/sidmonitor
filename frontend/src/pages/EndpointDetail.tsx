import { useState, useMemo, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell, LineChart, Line,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft, Activity, AlertTriangle, Clock, Zap,
  BarChart3, TrendingUp, Hash,
} from 'lucide-react'
import { useEndpointDetail } from '../hooks/useLogs'
import { useProjectUrl } from '../hooks/useProjectUrl'
import { TimeRangeSelector } from '@/components/ui'
import type { PresetRange, DateRange } from '@/components/ui'
import { cn } from '@/lib/utils'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-status-success/15 text-status-success',
  POST: 'bg-status-info/15 text-status-info',
  PUT: 'bg-status-warning/15 text-status-warning',
  PATCH: 'bg-accent/15 text-accent',
  DELETE: 'bg-status-danger/15 text-status-danger',
}

const STATUS_COLORS: Record<string, string> = {
  '2': 'var(--status-success)',
  '3': 'var(--accent-primary)',
  '4': 'var(--status-warning)',
  '5': 'var(--status-error)',
}

function getStatusColor(code: number): string {
  return STATUS_COLORS[String(code)[0]] || 'var(--text-muted)'
}

function formatMs(ms: number): string {
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function getTimeFormat(data: { timestamp: string }[]): string {
  if (data.length < 2) return 'HH:mm'
  const first = parseISO(data[0].timestamp)
  const last = parseISO(data[data.length - 1].timestamp)
  const hours = (last.getTime() - first.getTime()) / 3_600_000
  if (hours <= 48) return 'HH:mm'
  return 'MMM dd'
}

const tooltipStyle = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  fontSize: '13px',
}

function ChartSkeleton() {
  return (
    <div className="h-[260px] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center w-full">
        <div className="h-4 bg-surface-tertiary rounded w-32 mb-4" />
        <div className="h-48 bg-surface-tertiary/50 rounded w-full" />
      </div>
    </div>
  )
}

export default function EndpointDetail() {
  const [searchParams] = useSearchParams()
  const endpoint = searchParams.get('endpoint') || ''
  const method = searchParams.get('method') || ''
  const projectUrl = useProjectUrl()

  const [activePreset, setActivePreset] = useState<PresetRange | null>('24h')
  const [customRange, setCustomRange] = useState<DateRange | null>(null)

  const { startDate, endDate } = useMemo(() => {
    if (customRange) return { startDate: customRange.start, endDate: customRange.end }
    const presetMs: Record<PresetRange, number> = {
      '1h': 3600_000, '6h': 6 * 3600_000, '24h': 24 * 3600_000,
      '7d': 7 * 24 * 3600_000, '30d': 30 * 24 * 3600_000,
    }
    const now = new Date()
    return {
      startDate: new Date(now.getTime() - presetMs[activePreset || '24h']).toISOString(),
      endDate: now.toISOString(),
    }
  }, [activePreset, customRange])

  const { data, isLoading } = useEndpointDetail(endpoint, method, startDate, endDate)

  const handlePresetChange = useCallback((preset: PresetRange) => {
    setActivePreset(preset)
    setCustomRange(null)
  }, [])

  const handleCustomRangeChange = useCallback((range: DateRange) => {
    setCustomRange(range)
    setActivePreset(null)
  }, [])

  const timeseriesFormatted = useMemo(() => {
    if (!data?.timeseries?.length) return []
    const fmt = getTimeFormat(data.timeseries)
    return data.timeseries.map(p => ({
      ...p,
      time: format(parseISO(p.timestamp), fmt),
    }))
  }, [data?.timeseries])

  const latencyFormatted = useMemo(() => {
    if (!data?.latency_timeline?.length) return []
    const fmt = getTimeFormat(data.latency_timeline)
    return data.latency_timeline.map(p => ({
      ...p,
      time: format(parseISO(p.timestamp), fmt),
    }))
  }, [data?.latency_timeline])

  const s = data?.summary

  if (!endpoint || !method) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <p className="text-text-muted">Missing endpoint or method parameter.</p>
        <Link to={projectUrl('endpoints')} className="text-accent hover:underline mt-2 inline-block">
          Back to Endpoints
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <Link
            to={projectUrl('endpoints')}
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            All Endpoints
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <span className={cn(
              'inline-flex px-2.5 py-1 text-xs font-bold rounded',
              METHOD_COLORS[method] || 'bg-surface-tertiary text-text-muted'
            )}>
              {method}
            </span>
            <h1 className="text-xl font-bold text-text-primary font-mono truncate" title={endpoint}>
              {endpoint}
            </h1>
          </div>
          <p className="text-sm text-text-muted mt-1">
            {isLoading ? 'Loading...' : s ? `${formatCount(s.request_count)} requests · ${s.requests_per_minute} rpm` : 'No data'}
          </p>
        </div>
        <div className="flex-shrink-0">
          <TimeRangeSelector
            presets={['1h', '6h', '24h', '7d']}
            activePreset={activePreset}
            onPresetChange={handlePresetChange}
            customRange={customRange}
            onCustomRangeChange={handleCustomRangeChange}
          />
        </div>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-lg border border-border-subtle px-4 py-3 animate-pulse">
              <div className="h-3 w-16 bg-surface-tertiary rounded mb-2" />
              <div className="h-6 w-20 bg-surface-tertiary rounded" />
            </div>
          ))}
        </div>
      ) : s ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <SummaryCard
            icon={<Activity className="w-4 h-4" />}
            label="Total Requests"
            value={formatCount(s.request_count)}
          />
          <SummaryCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Error Rate"
            value={`${s.error_rate.toFixed(2)}%`}
            valueColor={s.error_rate > 5 ? 'text-status-danger' : s.error_rate > 1 ? 'text-status-warning' : 'text-status-success'}
          />
          <SummaryCard
            icon={<Clock className="w-4 h-4" />}
            label="Avg Latency"
            value={formatMs(s.avg_response_time)}
            valueColor={s.avg_response_time > 2000 ? 'text-status-danger' : s.avg_response_time > 500 ? 'text-status-warning' : 'text-text-primary'}
          />
          <SummaryCard
            icon={<Zap className="w-4 h-4" />}
            label="P95 Latency"
            value={formatMs(s.p95_response_time)}
            valueColor={s.p95_response_time > 3000 ? 'text-status-danger' : s.p95_response_time > 1000 ? 'text-status-warning' : 'text-text-primary'}
          />
          <SummaryCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="P99 Latency"
            value={formatMs(s.p99_response_time)}
            valueColor={s.p99_response_time > 5000 ? 'text-status-danger' : s.p99_response_time > 2000 ? 'text-status-warning' : 'text-text-primary'}
          />
        </div>
      ) : null}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Throughput chart */}
        <div className="bg-surface rounded-xl border border-border-primary p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            Throughput
          </h3>
          {isLoading ? <ChartSkeleton /> : timeseriesFormatted.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-text-muted">No data in this time range</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={timeseriesFormatted}>
                <defs>
                  <linearGradient id="epReqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="epErrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--status-error)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--status-error)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} dy={8} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} dx={-4} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }} cursor={{ stroke: 'var(--border-primary)', strokeDasharray: '4 4' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="requests" name="Requests" stroke="var(--accent-primary)" strokeWidth={2} fill="url(#epReqGrad)" dot={false} activeDot={{ r: 4, fill: 'var(--accent-primary)', stroke: 'var(--bg-primary)', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="errors" name="Errors" stroke="var(--status-error)" strokeWidth={2} fill="url(#epErrGrad)" dot={false} activeDot={{ r: 4, fill: 'var(--status-error)', stroke: 'var(--bg-primary)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Latency percentiles chart */}
        <div className="bg-surface rounded-xl border border-border-primary p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            Latency Percentiles
          </h3>
          {isLoading ? <ChartSkeleton /> : latencyFormatted.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-text-muted">No data in this time range</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={latencyFormatted}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} dy={8} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} dx={-4} tickFormatter={(v: number) => formatMs(v)} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }} formatter={(value: number) => formatMs(value)} cursor={{ stroke: 'var(--border-primary)', strokeDasharray: '4 4' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} iconType="line" iconSize={14} />
                <Line type="monotone" dataKey="avg" name="Avg" stroke="var(--accent-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="p50" name="P50" stroke="var(--status-success)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="p95" name="P95" stroke="var(--status-warning)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="p99" name="P99" stroke="var(--status-error)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom section: Status codes + Recent errors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Status code breakdown */}
        <div className="bg-surface rounded-xl border border-border-primary p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Hash className="w-4 h-4 text-accent" />
            Status Codes
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-surface-tertiary/50 animate-pulse rounded" />
              ))}
            </div>
          ) : !data?.status_codes?.length ? (
            <div className="h-40 flex items-center justify-center text-sm text-text-muted">No data</div>
          ) : (
            <div className="space-y-0.5">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.status_codes} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="status_code" tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'monospace' }} width={40} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, _: string, entry: { payload?: { percentage?: number } }) => [`${formatCount(value)} (${entry.payload?.percentage ?? 0}%)`, 'Count']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {data.status_codes.map((sc) => (
                      <Cell key={sc.status_code} fill={getStatusColor(sc.status_code)} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Legend below chart */}
              <div className="mt-3 space-y-1.5">
                {data.status_codes.map(sc => (
                  <div key={sc.status_code} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getStatusColor(sc.status_code), opacity: 0.7 }} />
                      <span className="font-mono text-text-secondary">{sc.status_code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted">{sc.percentage.toFixed(1)}%</span>
                      <span className="text-text-primary font-medium tabular-nums">{formatCount(sc.count)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent errors */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border-primary p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-status-danger" />
            Recent Errors
            {data?.recent_errors?.length ? (
              <span className="text-xs text-text-muted font-normal">({data.recent_errors.length})</span>
            ) : null}
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-surface-tertiary/50 animate-pulse rounded" />
              ))}
            </div>
          ) : !data?.recent_errors?.length ? (
            <div className="h-40 flex items-center justify-center text-sm text-text-muted">
              No errors in this time range
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="pr-4 pb-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Time</th>
                    <th className="px-4 pb-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                    <th className="px-4 pb-2 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Latency</th>
                    <th className="px-4 pb-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">User</th>
                    <th className="pl-4 pb-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Request ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {data.recent_errors.map((err, idx) => (
                    <tr key={`${err.request_id}-${idx}`} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="pr-4 py-2.5 text-xs text-text-secondary whitespace-nowrap tabular-nums">
                        {format(parseISO(err.timestamp), 'MMM dd HH:mm:ss')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 text-[11px] font-bold rounded',
                          err.status_code >= 500 ? 'bg-status-danger/15 text-status-danger' : 'bg-status-warning/15 text-status-warning'
                        )}>
                          {err.status_code}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs font-medium text-text-primary tabular-nums">
                          {formatMs(err.response_time_ms)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary truncate max-w-[120px]">
                        {err.user_name || err.user_id || '—'}
                      </td>
                      <td className="pl-4 py-2.5">
                        <span className="text-xs text-text-muted font-mono truncate block max-w-[140px]" title={err.request_id}>
                          {err.request_id.slice(0, 12)}...
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, valueColor = 'text-text-primary' }: {
  icon: React.ReactNode
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="bg-surface rounded-lg border border-border-subtle px-4 py-3">
      <div className="text-xs text-text-muted flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className={cn('text-xl font-bold mt-0.5 tabular-nums', valueColor)}>
        {value}
      </div>
    </div>
  )
}
