import { useState, useCallback, useEffect } from 'react'
import { Radio, Pause } from 'lucide-react'
import FilterPanel from '../components/logs/FilterPanel'
import SavedViewsBar from '../components/logs/SavedViewsBar'
import LogTable from '../components/logs/LogTable'
import { DetailsModal, ErrorAlert, ExportButton, Pagination } from '@/components/ui'
import type { DetailField } from '@/components/ui'
import { useLogs, useModules } from '../hooks/useLogs'
import { useSavedViews } from '../hooks/useSavedViews'
import { downloadFile, convertToCSV, generateFilename } from '../utils/exportHelpers'
import { DEFAULT_PAGE_SIZE } from '../utils/constants'
import { cn } from '@/lib/utils'
import type { FilterParams, LogEntry } from '../types'

const LIVE_TAIL_INTERVAL = 3000

const CSV_HEADERS = ['timestamp', 'method', 'endpoint', 'status_code', 'response_time_ms', 'user', 'module']

function csvRowMapper(log: LogEntry) {
  return [
    log.timestamp,
    log.method,
    log.endpoint,
    log.status_code,
    log.response_time_ms,
    log.user_name || log.user_id || '',
    log.module || '',
  ]
}

function buildFilterParts(filters: FilterParams): string[] {
  const parts: string[] = []
  if (filters.status) parts.push(`status-${filters.status}`)
  if (filters.module) parts.push(`module-${filters.module}`)
  if (filters.endpoint) parts.push('filtered')
  if (filters.user) parts.push('filtered')
  return parts
}

export default function Logs() {
  const [filters, setFilters] = useState<FilterParams>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
  })
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [liveTail, setLiveTail] = useState(false)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const { data: logsData, isLoading: logsLoading, error: logsError, dataUpdatedAt } = useLogs(
    filters,
    liveTail ? LIVE_TAIL_INTERVAL : false
  )
  const { data: modules = [] } = useModules()
  const { data: savedViews = [] } = useSavedViews()

  // Auto-apply default saved view on first load
  useEffect(() => {
    if (savedViews.length > 0 && !activeViewId) {
      const defaultView = savedViews.find(v => v.is_default)
      if (defaultView) {
        setFilters(prev => ({ ...defaultView.filters, page: 1, page_size: prev.page_size }))
        setActiveViewId(defaultView.id)
      }
    }
    // Only run when savedViews first loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedViews.length])

  // Auto-disable live tail when navigating away from page 1
  useEffect(() => {
    if (liveTail && filters.page && filters.page > 1) {
      setLiveTail(false)
    }
  }, [filters.page, liveTail])

  const handleFilterChange = useCallback((newFilters: FilterParams) => {
    setFilters(newFilters)
    setActiveViewId(null)
  }, [])

  const handleApplyView = useCallback((viewFilters: FilterParams, viewId: string) => {
    setFilters({ ...viewFilters, page: 1, page_size: filters.page_size })
    setActiveViewId(viewId)
  }, [filters.page_size])

  const handleClearView = useCallback(() => {
    setFilters({ page: 1, page_size: filters.page_size })
    setActiveViewId(null)
  }, [filters.page_size])

  const handleRowClick = useCallback((log: LogEntry) => {
    setSelectedLog(log)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setFilters((prev) => ({ ...prev, page_size: pageSize, page: 1 }))
  }, [])

  const handleToggleLiveTail = useCallback(() => {
    setLiveTail(prev => {
      if (!prev) {
        // When enabling, jump to page 1
        setFilters(f => ({ ...f, page: 1 }))
      }
      return !prev
    })
  }, [])

  const handleExportCSV = useCallback(() => {
    if (!logsData?.data || logsData.data.length === 0) {
      return
    }
    const csv = convertToCSV(logsData.data, CSV_HEADERS, csvRowMapper)
    const filename = generateFilename('logs', 'csv', buildFilterParts(filters))
    downloadFile(csv, filename, 'text/csv')
  }, [logsData, filters])

  const handleExportJSON = useCallback(() => {
    if (!logsData?.data || logsData.data.length === 0) {
      return
    }
    const json = JSON.stringify(logsData.data, null, 2)
    const filename = generateFilename('logs', 'json', buildFilterParts(filters))
    downloadFile(json, filename, 'application/json')
  }, [logsData, filters])

  const totalPages = logsData?.total_pages || 1
  const currentPage = filters.page || 1
  const pageSize = filters.page_size || DEFAULT_PAGE_SIZE

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">Log Viewer</h1>
          {liveTail && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-status-success/10 text-status-success">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success" />
              </span>
              Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleLiveTail}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
              liveTail
                ? 'bg-status-success/10 border-status-success/30 text-status-success hover:bg-status-success/20'
                : 'bg-surface border-border-primary text-text-secondary hover:bg-surface-secondary'
            )}
            title={liveTail ? 'Pause live tail' : 'Start live tail (auto-refresh every 3s)'}
          >
            {liveTail ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                Live Tail
              </>
            )}
          </button>
          <ExportButton
            disabled={!logsData?.data || logsData.data.length === 0 || logsLoading}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
          />
        </div>
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        modules={modules}
        loading={logsLoading}
      />

      <SavedViewsBar
        currentFilters={filters}
        activeViewId={activeViewId}
        onApplyView={handleApplyView}
        onClearView={handleClearView}
      />

      {logsError && <ErrorAlert message="Failed to load logs" description="Please check your connection." className="mb-4" />}

      <div className={cn(
        'bg-surface shadow rounded-lg',
        liveTail && 'ring-1 ring-status-success/20'
      )}>
        {liveTail && (
          <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-status-success" />
              Auto-refreshing every {LIVE_TAIL_INTERVAL / 1000}s
            </span>
            <span className="tabular-nums">
              Last update: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}
            </span>
          </div>
        )}
        <div className="px-4 py-5 sm:p-6">
          <LogTable
            logs={logsData?.data || []}
            loading={logsLoading}
            onRowClick={handleRowClick}
          />

          {logsData && logsData.total > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              total={logsData.total}
              loading={logsLoading}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      </div>

      <DetailsModal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Log Details"
        fields={selectedLog ? [
          { label: 'Request ID', value: <span className="font-mono">{selectedLog.request_id}</span> },
          { label: 'Timestamp', value: selectedLog.timestamp },
          { label: 'Method', value: selectedLog.method },
          { label: 'Endpoint', value: <span className="font-mono">{selectedLog.endpoint}</span> },
          { label: 'Status Code', value: selectedLog.status_code },
          { label: 'Response Time', value: selectedLog.response_time_ms < 1000 ? `${Math.round(selectedLog.response_time_ms)}ms` : `${(selectedLog.response_time_ms / 1000).toFixed(2)}s` },
          { label: 'User ID', value: selectedLog.user_id, hidden: !selectedLog.user_id },
          { label: 'User Name', value: selectedLog.user_name, hidden: !selectedLog.user_name },
          { label: 'Module', value: selectedLog.module, hidden: !selectedLog.module },
          { label: 'Third Party Service', value: selectedLog.third_party_service, hidden: !selectedLog.is_outbound || !selectedLog.third_party_service },
          { label: 'Tags', value: selectedLog.tags?.length ? (
            <div className="flex flex-wrap gap-2">{selectedLog.tags.map(tag => (
              <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-info/10 text-status-info">{tag}</span>
            ))}</div>
          ) : null, hidden: !selectedLog.tags?.length, colSpan: 2 },
        ] as DetailField[] : []}
      />
    </div>
  )
}
