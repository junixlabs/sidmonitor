import { useState, useCallback } from 'react'
import FilterPanel from '../components/logs/FilterPanel'
import LogTable from '../components/logs/LogTable'
import { DetailsModal, ErrorAlert, ExportButton, Pagination } from '@/components/ui'
import type { DetailField } from '@/components/ui'
import { useLogs, useModules } from '../hooks/useLogs'
import { downloadFile, convertToCSV, generateFilename } from '../utils/exportHelpers'
import { DEFAULT_PAGE_SIZE } from '../utils/constants'
import type { FilterParams, LogEntry } from '../types'

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

  const { data: logsData, isLoading: logsLoading, error: logsError } = useLogs(filters)
  const { data: modules = [] } = useModules()

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
        <h1 className="text-2xl font-semibold text-text-primary">Log Viewer</h1>

        <ExportButton
          disabled={!logsData?.data || logsData.data.length === 0 || logsLoading}
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
        />
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
