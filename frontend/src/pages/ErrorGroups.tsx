import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle, Search, ChevronDown, ChevronRight,
  Clock, Users, ExternalLink, ShieldAlert, ShieldX,
} from 'lucide-react'
import { useErrorGroups } from '../hooks/useLogs'
import { useProjectUrl } from '../hooks/useProjectUrl'
import { TimeRangeSelector } from '@/components/ui'
import type { PresetRange, DateRange } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ErrorGroup } from '@/types'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-status-success/15 text-status-success',
  POST: 'bg-status-info/15 text-status-info',
  PUT: 'bg-status-warning/15 text-status-warning',
  PATCH: 'bg-accent/15 text-accent',
  DELETE: 'bg-status-danger/15 text-status-danger',
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

type StatusFilter = 'all' | '4xx' | '5xx'

function ErrorGroupRow({ group, projectUrl }: { group: ErrorGroup; projectUrl: (p: string) => string }) {
  const [expanded, setExpanded] = useState(false)
  const is5xx = group.status_code >= 500

  return (
    <>
      <tr
        className="hover:bg-surface-secondary/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <button className="text-text-muted hover:text-text-primary transition-colors">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <span className={cn(
            'inline-flex px-2 py-0.5 text-[11px] font-bold rounded',
            is5xx ? 'bg-status-danger/15 text-status-danger' : 'bg-status-warning/15 text-status-warning'
          )}>
            {group.status_code}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded shrink-0',
              METHOD_COLORS[group.method] || 'bg-surface-tertiary text-text-muted'
            )}>
              {group.method}
            </span>
            <Link
              to={projectUrl(`endpoint-detail?endpoint=${encodeURIComponent(group.endpoint)}&method=${group.method}`)}
              className="text-sm text-text-primary hover:text-accent transition-colors font-mono truncate"
              title={group.endpoint}
              onClick={(e) => e.stopPropagation()}
            >
              {group.endpoint}
            </Link>
          </div>
          <span className="text-xs text-text-muted mt-0.5 block">{group.status_description}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-sm font-semibold text-text-primary tabular-nums">{formatCount(group.count)}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-xs text-text-muted tabular-nums">
            {formatDistanceToNow(parseISO(group.last_seen), { addSuffix: true })}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-xs text-text-secondary tabular-nums">{formatMs(group.avg_response_time)}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-xs text-text-muted tabular-nums">{group.affected_users}</span>
        </td>
      </tr>
      {expanded && group.recent_instances.length > 0 && (
        <tr>
          <td colSpan={7} className="px-0 py-0">
            <div className="bg-surface-secondary/30 border-y border-border-subtle">
              <div className="px-8 py-2">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1.5">
                  Recent Occurrences
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-border-subtle/50">
                    {group.recent_instances.map((inst, i) => (
                      <tr key={`${inst.request_id}-${i}`}>
                        <td className="py-1.5 pr-4">
                          <span className="text-xs text-text-secondary tabular-nums">
                            {format(parseISO(inst.timestamp), 'MMM dd HH:mm:ss')}
                          </span>
                        </td>
                        <td className="py-1.5 pr-4">
                          <span className="text-xs text-text-primary tabular-nums">{formatMs(inst.response_time_ms)}</span>
                        </td>
                        <td className="py-1.5 pr-4">
                          <span className="text-xs text-text-muted">{inst.user_name || inst.user_id || '—'}</span>
                        </td>
                        <td className="py-1.5">
                          <Link
                            to={projectUrl(`logs?request_id=${inst.request_id}`)}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="font-mono">{inst.request_id.slice(0, 12)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function ErrorGroups() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [activePreset, setActivePreset] = useState<PresetRange | null>('24h')
  const [customRange, setCustomRange] = useState<DateRange | null>(null)
  const projectUrl = useProjectUrl()

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

  const { data, isLoading } = useErrorGroups(startDate, endDate, statusFilter)

  const handlePresetChange = useCallback((preset: PresetRange) => {
    setActivePreset(preset)
    setCustomRange(null)
  }, [])

  const handleCustomRangeChange = useCallback((range: DateRange) => {
    setCustomRange(range)
    setActivePreset(null)
  }, [])

  const filtered = useMemo(() => {
    if (!data?.groups) return []
    if (!search) return data.groups
    const q = search.toLowerCase()
    return data.groups.filter(g =>
      g.endpoint.toLowerCase().includes(q) ||
      g.status_description.toLowerCase().includes(q) ||
      String(g.status_code).includes(q)
    )
  }, [data?.groups, search])

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-status-danger/10">
              <AlertTriangle className="w-4.5 h-4.5 text-status-danger" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Error Groups</h1>
          </div>
          <p className="text-sm text-text-muted mt-1">
            {isLoading ? 'Loading...' : data
              ? `${data.total_groups} groups · ${formatCount(data.total_errors)} total errors`
              : 'No data'}
          </p>
        </div>
        <TimeRangeSelector
          presets={['1h', '6h', '24h', '7d']}
          activePreset={activePreset}
          onPresetChange={handlePresetChange}
          customRange={customRange}
          onCustomRangeChange={handleCustomRangeChange}
        />
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-lg border border-border-subtle px-4 py-3 animate-pulse">
              <div className="h-3 w-20 bg-surface-tertiary rounded mb-2" />
              <div className="h-6 w-14 bg-surface-tertiary rounded" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="bg-surface rounded-lg border border-border-subtle px-4 py-3">
            <div className="text-xs text-text-muted flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Total Errors
            </div>
            <div className={cn('text-xl font-bold mt-0.5', data.total_errors > 0 ? 'text-status-danger' : 'text-status-success')}>
              {formatCount(data.total_errors)}
            </div>
          </div>
          <div className="bg-surface rounded-lg border border-border-subtle px-4 py-3">
            <div className="text-xs text-text-muted">Error Groups</div>
            <div className="text-xl font-bold text-text-primary mt-0.5">{data.total_groups}</div>
          </div>
          <div className="bg-surface rounded-lg border border-border-subtle px-4 py-3">
            <div className="text-xs text-text-muted flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Client Errors (4xx)
            </div>
            <div className={cn('text-xl font-bold mt-0.5', data.client_errors > 0 ? 'text-status-warning' : 'text-text-muted')}>
              {formatCount(data.client_errors)}
            </div>
          </div>
          <div className="bg-surface rounded-lg border border-border-subtle px-4 py-3">
            <div className="text-xs text-text-muted flex items-center gap-1">
              <ShieldX className="w-3 h-3" /> Server Errors (5xx)
            </div>
            <div className={cn('text-xl font-bold mt-0.5', data.server_errors > 0 ? 'text-status-danger' : 'text-text-muted')}>
              {formatCount(data.server_errors)}
            </div>
          </div>
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search errors..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-surface border border-border-primary rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex rounded-lg border border-border-primary overflow-hidden">
          {(['all', '4xx', '5xx'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors',
                statusFilter === f
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text-secondary hover:bg-surface-secondary'
              )}
            >
              {f === 'all' ? 'All' : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Error groups table */}
      <div className="bg-surface rounded-xl border border-border-primary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-secondary">
                <th className="px-4 py-3 w-10" />
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider w-20">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Endpoint</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-24">Count</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-28">Last Seen</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-24">
                  <span className="flex items-center justify-end gap-1"><Clock className="w-3 h-3" /> Avg</span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-20">
                  <span className="flex items-center justify-end gap-1"><Users className="w-3 h-3" /> Users</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 w-4 bg-surface-tertiary/50 animate-pulse rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-10 bg-surface-tertiary/50 animate-pulse rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-56 bg-surface-tertiary/50 animate-pulse rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-10 bg-surface-tertiary/50 animate-pulse rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-surface-tertiary/50 animate-pulse rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-12 bg-surface-tertiary/50 animate-pulse rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-8 bg-surface-tertiary/50 animate-pulse rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-text-muted/40" />
                      <p className="text-sm font-medium text-text-secondary">
                        {data?.total_errors === 0 ? 'No errors found' : 'No matching errors'}
                      </p>
                      <p className="text-sm text-text-muted">
                        {data?.total_errors === 0
                          ? 'Great! No errors in this time range.'
                          : 'Try adjusting your search or filters.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((group, idx) => (
                  <ErrorGroupRow
                    key={`${group.endpoint}-${group.method}-${group.status_code}-${idx}`}
                    group={group}
                    projectUrl={projectUrl}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
