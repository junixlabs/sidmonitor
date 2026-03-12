import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useOutboundLogs, useOutboundServices, useOutboundHosts, useOutboundStats, useOutboundServiceHealth, useOutboundHostHealth } from '../hooks/useOutboundLogs'
import { OutboundStatsCards, OutboundServiceHealth, OutboundHostHealth, ServiceEndpointDetails } from '../components/outbound'
import { DEFAULT_PAGE_SIZE, STATUS_OPTIONS, METHOD_OPTIONS } from '../utils/constants'
import { getStatusColor, getMethodColor } from '../utils/styleHelpers'
import { downloadFile, convertToCSV, generateFilename } from '../utils/exportHelpers'
import { formatLatency, formatBytes } from '../utils/format'
import { Pagination, ExportButton, DetailsModal } from '../components/common'
import type { DetailField } from '../components/common'
import { ErrorAlert } from '@/components/ui'
import type { OutboundLogFilterParams, OutboundLog } from '../types'

type TabType = 'logs' | 'dashboard'

const CSV_HEADERS = ['timestamp', 'service_name', 'target_host', 'target_url', 'method', 'status_code', 'latency_ms', 'request_size', 'response_size', 'trace_id']

function csvRowMapper(log: OutboundLog) {
  return [
    log.timestamp,
    log.service_name,
    log.target_host,
    log.target_url,
    log.method,
    log.status_code,
    log.latency_ms,
    log.request_size,
    log.response_size,
    log.trace_id,
  ]
}

function buildFilterParts(filters: OutboundLogFilterParams): string[] {
  const parts: string[] = []
  if (filters.status) parts.push(`status-${filters.status}`)
  if (filters.service_name) parts.push(`service-${filters.service_name}`)
  if (filters.target_host) parts.push(`host-${filters.target_host}`)
  return parts
}

export default function OutboundAPIs() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [filters, setFilters] = useState<OutboundLogFilterParams>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
  })
  const [selectedLog, setSelectedLog] = useState<OutboundLog | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)

  // Logs data
  const { data: logsData, isLoading: logsLoading, error: logsError } = useOutboundLogs(filters)
  const { data: services = [] } = useOutboundServices()
  const { data: hosts = [] } = useOutboundHosts()

  // Dashboard data
  const { data: stats, isLoading: statsLoading } = useOutboundStats()
  const { data: serviceHealth, isLoading: serviceHealthLoading } = useOutboundServiceHealth()
  const { data: hostHealth, isLoading: hostHealthLoading } = useOutboundHostHealth()

  const handleFilterChange = useCallback((key: keyof OutboundLogFilterParams, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }))
  }, [])

  const handleReset = useCallback(() => {
    setFilters({ page: 1, page_size: filters.page_size })
  }, [filters.page_size])

  const handleRowClick = useCallback((log: OutboundLog) => {
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
    const filename = generateFilename('outbound-logs', 'csv', buildFilterParts(filters))
    downloadFile(csv, filename, 'text/csv')
  }, [logsData, filters])

  const handleExportJSON = useCallback(() => {
    if (!logsData?.data || logsData.data.length === 0) return
    const json = JSON.stringify(logsData.data, null, 2)
    const filename = generateFilename('outbound-logs', 'json', buildFilterParts(filters))
    downloadFile(json, filename, 'application/json')
  }, [logsData, filters])

  const handleServiceClick = useCallback((serviceName: string) => {
    setSelectedService(serviceName)
  }, [])

  const handleCloseServiceDetails = useCallback(() => {
    setSelectedService(null)
  }, [])

  const handleViewLogs = useCallback((serviceName: string, _endpointPattern: string, method: string) => {
    // Set filters and switch to logs tab
    setFilters((prev) => ({
      ...prev,
      service_name: serviceName,
      method: method,
      page: 1,
    }))
    setSelectedService(null)
    setActiveTab('logs')
  }, [])

  const totalPages = logsData?.total_pages || 1
  const currentPage = filters.page || 1
  const pageSize = filters.page_size || DEFAULT_PAGE_SIZE

  const detailFields: DetailField[] = selectedLog ? [
    { label: 'Trace ID', value: <span className="font-mono break-all">{selectedLog.trace_id}</span> },
    { label: 'Span ID', value: <span className="font-mono">{selectedLog.span_id}</span> },
    { label: 'Parent Request ID', value: selectedLog.parent_request_id, hidden: !selectedLog.parent_request_id },
    { label: 'Timestamp', value: format(new Date(selectedLog.timestamp), 'PPpp') },
    { label: 'Service Name', value: selectedLog.service_name },
    { label: 'Method', value: selectedLog.method },
    { label: 'Target URL', value: <span className="font-mono break-all">{selectedLog.target_url}</span>, colSpan: 2 },
    { label: 'Target Host', value: selectedLog.target_host },
    { label: 'Status Code', value: <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', getStatusColor(selectedLog.status_code))}>{selectedLog.status_code}</span> },
    { label: 'Latency', value: formatLatency(selectedLog.latency_ms) },
    { label: 'Request Size', value: formatBytes(selectedLog.request_size) },
    { label: 'Response Size', value: formatBytes(selectedLog.response_size) },
    { label: 'Error Message', value: <span className="text-status-danger font-mono bg-status-danger/10 p-2 rounded">{selectedLog.error_message}</span>, colSpan: 2, hidden: !selectedLog.error_message },
  ] : []

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Outbound APIs</h1>
          <p className="mt-1 text-sm text-text-muted">Monitor external API calls made by your application</p>
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
          <OutboundStatsCards stats={stats} loading={statsLoading} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OutboundServiceHealth
              data={serviceHealth}
              loading={serviceHealthLoading}
              onServiceClick={handleServiceClick}
            />
            <OutboundHostHealth data={hostHealth} loading={hostHealthLoading} />
          </div>
          {/* Service Endpoint Details Panel */}
          {selectedService && (
            <ServiceEndpointDetails
              serviceName={selectedService}
              onClose={handleCloseServiceDetails}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
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
            <label htmlFor="service-filter" className="block text-sm font-medium text-text-secondary">
              Service
            </label>
            <select
              id="service-filter"
              value={filters.service_name || ''}
              onChange={(e) => handleFilterChange('service_name', e.target.value)}
              disabled={logsLoading}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
            >
              <option value="">All Services</option>
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="host-filter" className="block text-sm font-medium text-text-secondary">
              Target Host
            </label>
            <select
              id="host-filter"
              value={filters.target_host || ''}
              onChange={(e) => handleFilterChange('target_host', e.target.value)}
              disabled={logsLoading}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
            >
              <option value="">All Hosts</option>
              {hosts.map((host) => (
                <option key={host} value={host}>
                  {host}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="trace-id-filter" className="block text-sm font-medium text-text-secondary">
              Trace ID
            </label>
            <input
              id="trace-id-filter"
              type="text"
              placeholder="Filter by trace ID..."
              value={filters.trace_id || ''}
              onChange={(e) => handleFilterChange('trace_id', e.target.value)}
              disabled={logsLoading}
              className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
            />
          </div>

          <div className="lg:col-span-2 flex items-end">
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
        <ErrorAlert message="Failed to load outbound logs" description="Please check your connection." className="mb-4" />
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
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Latency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Size
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
                          {log.service_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-1">
                          <span className={cn('font-medium', getMethodColor(log.method))}>
                            {log.method}
                          </span>
                          <span className="text-text-primary truncate max-w-xs" title={log.target_url}>
                            {log.target_host}
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
                        {formatLatency(log.latency_ms)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                        <span title={`Req: ${formatBytes(log.request_size)} / Res: ${formatBytes(log.response_size)}`}>
                          {formatBytes(log.request_size + log.response_size)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-text-muted">
                      No outbound logs found. Try adjusting your filters.
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
        title="Outbound Request Details"
        fields={detailFields}
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  )
}
