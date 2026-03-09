import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useInboundLogs, useInboundModules, useInboundStats, useInboundModuleHealth } from '../hooks/useInboundLogs'
import { InboundStatsCards, InboundModuleHealth, ModuleEndpointDetails } from '../components/inbound'
import { DEFAULT_PAGE_SIZE, STATUS_OPTIONS, METHOD_OPTIONS } from '../utils/constants'
import { getStatusColor, getMethodColor } from '../utils/styleHelpers'
import { downloadFile, convertToCSV, generateFilename } from '../utils/exportHelpers'
import { formatResponseTime } from '../utils/format'
import { Pagination, ExportButton, DetailsModal } from '../components/common'
import type { DetailField } from '../components/common'
import { ErrorAlert } from '@/components/ui'
import type { InboundLogFilterParams, InboundLog } from '../types'

type TabType = 'logs' | 'dashboard'

const CSV_HEADERS = ['timestamp', 'module', 'endpoint', 'method', 'status_code', 'response_time_ms', 'user_id', 'request_id']

function csvRowMapper(log: InboundLog) {
  return [
    log.timestamp,
    log.module,
    log.endpoint,
    log.method,
    log.status_code,
    log.response_time_ms,
    log.user_id || '',
    log.request_id,
  ]
}

function buildFilterParts(filters: InboundLogFilterParams): string[] {
  const parts: string[] = []
  if (filters.status) parts.push(`status-${filters.status}`)
  if (filters.module) parts.push(`module-${filters.module}`)
  if (filters.endpoint) parts.push(`endpoint-${filters.endpoint.replace(/\//g, '-')}`)
  return parts
}

function buildDetailFields(log: InboundLog): DetailField[] {
  return [
    { label: 'Request ID', value: <span className="font-mono break-all">{log.request_id}</span> },
    { label: 'Timestamp', value: format(new Date(log.timestamp), 'PPpp') },
    { label: 'Module', value: log.module },
    { label: 'Method', value: log.method },
    { label: 'Endpoint', value: <span className="font-mono break-all">{log.endpoint}</span>, colSpan: 2 },
    {
      label: 'Status Code',
      value: (
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            getStatusColor(log.status_code)
          )}
        >
          {log.status_code}
        </span>
      ),
    },
    { label: 'Response Time', value: formatResponseTime(log.response_time_ms) },
    { label: 'User ID', value: <span className="font-mono">{log.user_id}</span>, hidden: !log.user_id },
    { label: 'User Name', value: log.user_name, hidden: !log.user_name },
    {
      label: 'Tags',
      value: (
        <div className="flex flex-wrap gap-2">
          {log.tags?.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-tertiary text-text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      ),
      colSpan: 2,
      hidden: !log.tags || log.tags.length === 0,
    },
  ]
}

export default function InboundAPIs() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [filters, setFilters] = useState<InboundLogFilterParams>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
  })
  const [selectedLog, setSelectedLog] = useState<InboundLog | null>(null)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)

  // Logs data
  const { data: logsData, isLoading: logsLoading, error: logsError } = useInboundLogs(filters)
  const { data: modules = [] } = useInboundModules()

  // Dashboard data
  const { data: stats, isLoading: statsLoading } = useInboundStats()
  const { data: moduleHealth, isLoading: moduleHealthLoading } = useInboundModuleHealth()

  const handleFilterChange = useCallback((key: keyof InboundLogFilterParams, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }))
  }, [])

  const handleReset = useCallback(() => {
    setFilters({ page: 1, page_size: filters.page_size })
  }, [filters.page_size])

  const handleRowClick = useCallback((log: InboundLog) => {
    setSelectedLog(log)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setFilters((prev) => ({ ...prev, page_size: pageSize, page: 1 }))
  }, [])

  const handleExportCSV = useCallback(() => {
    if (!logsData?.data || logsData.data.length === 0) return
    const csv = convertToCSV(logsData.data, CSV_HEADERS, csvRowMapper)
    const filename = generateFilename('inbound-logs', 'csv', buildFilterParts(filters))
    downloadFile(csv, filename, 'text/csv')
  }, [logsData, filters])

  const handleExportJSON = useCallback(() => {
    if (!logsData?.data || logsData.data.length === 0) return
    const json = JSON.stringify(logsData.data, null, 2)
    const filename = generateFilename('inbound-logs', 'json', buildFilterParts(filters))
    downloadFile(json, filename, 'application/json')
  }, [logsData, filters])

  const handleModuleClick = useCallback((moduleName: string) => {
    setSelectedModule(moduleName)
  }, [])

  const handleCloseModuleDetails = useCallback(() => {
    setSelectedModule(null)
  }, [])

  const handleViewLogs = useCallback((moduleName: string, endpoint: string, method: string) => {
    // Set filters and switch to logs tab
    setFilters((prev) => ({
      ...prev,
      module: moduleName,
      endpoint: endpoint,
      method: method,
      page: 1,
    }))
    setSelectedModule(null)
    setActiveTab('logs')
  }, [])

  const totalPages = logsData?.total_pages || 1
  const currentPage = filters.page || 1
  const pageSize = filters.page_size || DEFAULT_PAGE_SIZE

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Inbound APIs</h1>
          <p className="mt-1 text-sm text-text-muted">Monitor incoming API requests to your application</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-4">
          <div className="border-b border-border-subtle">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm',
                  activeTab === 'dashboard'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-primary'
                )}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={cn(
                  'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm',
                  activeTab === 'logs'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-primary'
                )}
              >
                Logs
              </button>
            </nav>
          </div>

          {/* Export Dropdown Button - only show on logs tab */}
          {activeTab === 'logs' && (
            <ExportButton
              disabled={!logsData?.data || logsData.data.length === 0 || logsLoading}
              onExportCSV={handleExportCSV}
              onExportJSON={handleExportJSON}
            />
          )}
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <InboundStatsCards stats={stats} loading={statsLoading} />
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            <InboundModuleHealth
              data={moduleHealth}
              loading={moduleHealthLoading}
              onModuleClick={handleModuleClick}
            />
          </div>
          {/* Module Endpoint Details Panel */}
          {selectedModule && (
            <ModuleEndpointDetails
              moduleName={selectedModule}
              onClose={handleCloseModuleDetails}
              onViewLogs={handleViewLogs}
            />
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <>
      {/* Filter Panel */}
      <div className="bg-surface shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-text-secondary">
              Status
            </label>
            <select
              id="status-filter"
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              disabled={logsLoading}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="method-filter" className="block text-sm font-medium text-text-secondary">
              Method
            </label>
            <select
              id="method-filter"
              value={filters.method || ''}
              onChange={(e) => handleFilterChange('method', e.target.value)}
              disabled={logsLoading}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="module-filter" className="block text-sm font-medium text-text-secondary">
              Module
            </label>
            <select
              id="module-filter"
              value={filters.module || ''}
              onChange={(e) => handleFilterChange('module', e.target.value)}
              disabled={logsLoading}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
            >
              <option value="">All Modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="endpoint-filter" className="block text-sm font-medium text-text-secondary">
              Endpoint
            </label>
            <input
              id="endpoint-filter"
              type="text"
              placeholder="Filter by endpoint..."
              value={filters.endpoint || ''}
              onChange={(e) => handleFilterChange('endpoint', e.target.value)}
              disabled={logsLoading}
              className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
            />
          </div>

          <div>
            <label htmlFor="request-id-filter" className="block text-sm font-medium text-text-secondary">
              Request ID
            </label>
            <input
              id="request-id-filter"
              type="text"
              placeholder="Filter by request ID..."
              value={filters.request_id || ''}
              onChange={(e) => handleFilterChange('request_id', e.target.value)}
              disabled={logsLoading}
              className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleReset}
              disabled={logsLoading}
              className="w-full inline-flex justify-center py-2 px-4 border border-border-primary shadow-sm text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:bg-surface-tertiary"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {logsError && (
        <ErrorAlert message="Failed to load inbound logs" description="Please check your connection." className="mb-4" />
      )}

      {/* Logs Table */}
      <div className="bg-surface shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Module
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    User
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border-subtle">
                {logsLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-tertiary rounded animate-pulse w-32" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-tertiary rounded animate-pulse w-24" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-tertiary rounded animate-pulse w-48" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-tertiary rounded animate-pulse w-12" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-tertiary rounded animate-pulse w-16" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-tertiary rounded animate-pulse w-20" /></td>
                    </tr>
                  ))
                ) : logsData?.data && logsData.data.length > 0 ? (
                  logsData.data.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => handleRowClick(log)}
                      className="cursor-pointer hover:bg-surface-secondary transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                        {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent">
                          {log.module}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-1">
                          <span className={cn('font-medium', getMethodColor(log.method))}>
                            {log.method}
                          </span>
                          <span className="text-text-primary truncate max-w-xs" title={log.endpoint}>
                            {log.endpoint}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            getStatusColor(log.status_code)
                          )}
                        >
                          {log.status_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                        {formatResponseTime(log.response_time_ms)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                        {log.user_name || log.user_id || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-text-muted">
                      No inbound logs found. Try adjusting your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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
        </>
      )}

      {/* Log Detail Modal */}
      <DetailsModal
        title="Inbound Request Details"
        fields={selectedLog ? buildDetailFields(selectedLog) : []}
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  )
}
