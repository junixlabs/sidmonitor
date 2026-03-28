import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, ArrowUpDown, ArrowUp, ArrowDown, Search, AlertTriangle } from 'lucide-react'
import { useTopEndpoints } from '../hooks/useLogs'
import { useProjectUrl } from '../hooks/useProjectUrl'
import { TimeRangeSelector } from '@/components/ui'
import type { PresetRange, DateRange } from '@/components/ui'
import { cn } from '@/lib/utils'

type SortField = 'request_count' | 'error_rate' | 'avg_response_time' | 'error_count'
type SortDir = 'asc' | 'desc'

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

function ErrorRateBar({ rate }: { rate: number }) {
  const color = rate > 10 ? 'bg-status-danger' : rate > 5 ? 'bg-status-warning' : rate > 0 ? 'bg-status-warning/60' : 'bg-status-success'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className={cn(
        'text-xs font-medium tabular-nums',
        rate > 10 ? 'text-status-danger' : rate > 5 ? 'text-status-warning' : 'text-text-secondary'
      )}>
        {rate.toFixed(2)}%
      </span>
    </div>
  )
}

export default function Endpoints() {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('request_count')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [methodFilter, setMethodFilter] = useState<string>('')
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

  const { data: endpoints, isLoading } = useTopEndpoints(100, 'all', startDate, endDate)

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }, [sortField])

  const handlePresetChange = useCallback((preset: PresetRange) => {
    setActivePreset(preset)
    setCustomRange(null)
  }, [])

  const handleCustomRangeChange = useCallback((range: DateRange) => {
    setCustomRange(range)
    setActivePreset(null)
  }, [])

  const filtered = useMemo(() => {
    if (!endpoints) return []
    let result = [...endpoints]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(e => e.endpoint.toLowerCase().includes(q))
    }

    if (methodFilter) {
      result = result.filter(e => e.method === methodFilter)
    }

    result.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      return sortDir === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number)
    })

    return result
  }, [endpoints, search, methodFilter, sortField, sortDir])

  const methods = useMemo(() => {
    if (!endpoints) return []
    return [...new Set(endpoints.map(e => e.method))].sort()
  }, [endpoints])

  const summary = useMemo(() => {
    if (!endpoints || endpoints.length === 0) return null
    const total = endpoints.reduce((s, e) => s + e.request_count, 0)
    const errors = endpoints.reduce((s, e) => s + e.error_count, 0)
    const avgErrorRate = total > 0 ? (errors / total) * 100 : 0
    const highError = endpoints.filter(e => e.error_rate > 5).length
    return { total, errors, avgErrorRate, highError, count: endpoints.length }
  }, [endpoints])

  function SortHeader({ label, field }: { label: string; field: SortField }) {
    const active = sortField === field
    return (
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 group"
      >
        <span>{label}</span>
        {active ? (
          sortDir === 'desc' ? <ArrowDown className="w-3 h-3 text-accent" /> : <ArrowUp className="w-3 h-3 text-accent" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
              <BarChart3 className="w-4.5 h-4.5 text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Endpoints</h1>
          </div>
          <p className="text-sm text-text-muted mt-1">
            {isLoading ? 'Loading...' : summary ? `${summary.count} endpoints · ${formatCount(summary.total)} total requests` : 'No data'}
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
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="bg-surface rounded-lg border border-border-subtle px-4 py-3">
            <div className="text-xs text-text-muted">Total Endpoints</div>
            <div className="text-xl font-bold text-text-primary mt-0.5">{summary.count}</div>
          </div>
          <div className="bg-surface rounded-lg border border-border-subtle px-4 py-3">
            <div className="text-xs text-text-muted">Total Requests</div>
            <div className="text-xl font-bold text-text-primary mt-0.5">{formatCount(summary.total)}</div>
          </div>
          <div className="bg-surface rounded-lg border border-border-subtle px-4 py-3">
            <div className="text-xs text-text-muted">Avg Error Rate</div>
            <div className={cn('text-xl font-bold mt-0.5', summary.avgErrorRate > 5 ? 'text-status-danger' : 'text-status-success')}>
              {summary.avgErrorRate.toFixed(2)}%
            </div>
          </div>
          <div className="bg-surface rounded-lg border border-border-subtle px-4 py-3">
            <div className="text-xs text-text-muted flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> High Error Endpoints
            </div>
            <div className={cn('text-xl font-bold mt-0.5', summary.highError > 0 ? 'text-status-danger' : 'text-status-success')}>
              {summary.highError}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search endpoints..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-surface border border-border-primary rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="text-sm border border-border-primary rounded-lg px-3 py-2 bg-surface text-text-primary"
        >
          <option value="">All Methods</option>
          {methods.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border-primary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-secondary">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider w-20">
                  Method
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-28 cursor-pointer">
                  <div className="flex justify-end">
                    <SortHeader label="Requests" field="request_count" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-36 cursor-pointer">
                  <div className="flex justify-end">
                    <SortHeader label="Error Rate" field="error_rate" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-24 cursor-pointer">
                  <div className="flex justify-end">
                    <SortHeader label="Errors" field="error_count" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-28 cursor-pointer">
                  <div className="flex justify-end">
                    <SortHeader label="Avg Time" field="avg_response_time" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 w-48 bg-surface-tertiary/50 animate-pulse rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-12 bg-surface-tertiary/50 animate-pulse rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-surface-tertiary/50 animate-pulse rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-surface-tertiary/50 animate-pulse rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-10 bg-surface-tertiary/50 animate-pulse rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-14 bg-surface-tertiary/50 animate-pulse rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-text-secondary">No endpoints found</p>
                    <p className="text-sm text-text-muted mt-1">
                      {search ? 'Try adjusting your search.' : 'No request data in this time range.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((ep, idx) => (
                  <tr key={`${ep.method}-${ep.endpoint}-${idx}`} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={projectUrl(`endpoint-detail?endpoint=${encodeURIComponent(ep.endpoint)}&method=${ep.method}`)}
                        className="text-sm text-text-primary hover:text-accent transition-colors font-mono truncate block max-w-[400px]"
                        title={ep.endpoint}
                      >
                        {ep.endpoint}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 text-[11px] font-bold rounded',
                        METHOD_COLORS[ep.method] || 'bg-surface-tertiary text-text-muted'
                      )}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-text-primary tabular-nums">
                        {formatCount(ep.request_count)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ErrorRateBar rate={ep.error_rate} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'text-sm tabular-nums',
                        ep.error_count > 0 ? 'text-status-danger font-medium' : 'text-text-muted'
                      )}>
                        {formatCount(ep.error_count)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'text-sm font-medium tabular-nums',
                        ep.avg_response_time > 2000 ? 'text-status-danger' :
                        ep.avg_response_time > 500 ? 'text-status-warning' :
                        'text-text-primary'
                      )}>
                        {formatMs(ep.avg_response_time)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
