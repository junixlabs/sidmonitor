import { useState, useCallback, useEffect, useRef } from 'react'
import FilterPanel from '../components/logs/FilterPanel'
import LogTable from '../components/logs/LogTable'
import { DetailsModal, ErrorAlert } from '@/components/ui'
import type { DetailField } from '@/components/ui'
import { useLogs, useModules } from '../hooks/useLogs'
import { formatCount } from '../utils/format'
import type { FilterParams, LogEntry } from '../types'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [20, 50, 100]

// Helper function to convert logs to CSV format
function convertToCSV(logs: LogEntry[]): string {
  const headers = ['timestamp', 'method', 'endpoint', 'status_code', 'response_time_ms', 'user', 'module']
  const csvRows = [headers.join(',')]

  logs.forEach((log) => {
    const row = [
      log.timestamp,
      log.method,
      `"${log.endpoint.replace(/"/g, '""')}"`, // Escape quotes in endpoint
      log.status_code,
      log.response_time_ms,
      log.user_name || log.user_id || '',
      log.module || '',
    ]
    csvRows.push(row.join(','))
  })

  return csvRows.join('\n')
}

// Helper function to generate filename with current date and filter info
function generateFilename(format: 'csv' | 'json', filters: FilterParams): string {
  const date = new Date().toISOString().split('T')[0]
  let filename = `logs-${date}`

  // Add filter info to filename if filtered
  const filterParts: string[] = []
  if (filters.status) filterParts.push(`status-${filters.status}`)
  if (filters.module) filterParts.push(`module-${filters.module}`)
  if (filters.endpoint) filterParts.push('filtered')
  if (filters.user) filterParts.push('filtered')

  if (filterParts.length > 0) {
    filename += `-${filterParts.join('-')}`
  }

  return `${filename}.${format}`
}

// Helper function to trigger browser download
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function Logs() {
  const [filters, setFilters] = useState<FilterParams>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
  })
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const { data: logsData, isLoading: logsLoading, error: logsError } = useLogs(filters)
  const { data: modules = [] } = useModules()

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showExportMenu])

  const handleFilterChange = useCallback((newFilters: FilterParams) => {
    setFilters(newFilters)
  }, [])

  const handleRowClick = useCallback((log: LogEntry) => {
    setSelectedLog(log)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setFilters((prev) => ({ ...prev, page_size: pageSize, page: 1 }))
  }, [])

  const handleExportCSV = useCallback(() => {
    if (!logsData?.data || logsData.data.length === 0) {
      return
    }
    const csv = convertToCSV(logsData.data)
    const filename = generateFilename('csv', filters)
    downloadFile(csv, filename, 'text/csv')
    setShowExportMenu(false)
  }, [logsData, filters])

  const handleExportJSON = useCallback(() => {
    if (!logsData?.data || logsData.data.length === 0) {
      return
    }
    const json = JSON.stringify(logsData.data, null, 2)
    const filename = generateFilename('json', filters)
    downloadFile(json, filename, 'application/json')
    setShowExportMenu(false)
  }, [logsData, filters])

  const totalPages = logsData?.total_pages || 1
  const currentPage = filters.page || 1
  const pageSize = filters.page_size || DEFAULT_PAGE_SIZE

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Log Viewer</h1>

        {/* Export Dropdown Button */}
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={!logsData?.data || logsData.data.length === 0 || logsLoading}
            className="inline-flex items-center px-4 py-2 border border-border-primary shadow-sm text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-5 w-5 mr-2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
            <svg className="ml-2 h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showExportMenu && (
            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-surface ring-1 ring-black ring-opacity-5 z-10">
              <div className="py-1" role="menu">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                  role="menuitem"
                >
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export as CSV
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                  role="menuitem"
                >
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Export as JSON
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        modules={modules}
        loading={logsLoading}
      />

      {logsError && <ErrorAlert message="Failed to load logs" description="Please check your connection." className="mb-4" />}

      <div className="bg-surface shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <LogTable
            logs={logsData?.data || []}
            loading={logsLoading}
            onRowClick={handleRowClick}
          />

          {logsData && logsData.total > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border-subtle pt-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-text-secondary">
                  Showing{' '}
                  <span className="font-medium">
                    {(currentPage - 1) * pageSize + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * pageSize, logsData.total)}
                  </span>{' '}
                  of <span className="font-medium">{formatCount(logsData.total)}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="pageSize" className="text-sm text-text-secondary">
                    Per page:
                  </label>
                  <select
                    id="pageSize"
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="border-border-primary rounded-md text-sm focus:ring-accent focus:border-accent"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || logsLoading}
                  className="relative inline-flex items-center px-4 py-2 border border-border-primary text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-text-secondary">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || logsLoading}
                  className="relative inline-flex items-center px-4 py-2 border border-border-primary text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
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
