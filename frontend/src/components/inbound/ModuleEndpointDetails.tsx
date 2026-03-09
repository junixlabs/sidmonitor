import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui'
import { formatResponseTime } from '@/utils/format'
import { getMethodBadgeColor, getSuccessRateColor, getSuccessRateBadgeColor } from '@/utils/styleHelpers'
import { useModuleEndpoints } from '../../hooks/useInboundLogs'
import type { InboundEndpointStats } from '../../types'

interface ModuleEndpointDetailsProps {
  moduleName: string
  onClose: () => void
  onViewLogs: (moduleName: string, endpoint: string, method: string) => void
}

export default function ModuleEndpointDetails({
  moduleName,
  onClose,
  onViewLogs,
}: ModuleEndpointDetailsProps) {
  const { data: endpoints = [], isLoading } = useModuleEndpoints(moduleName)

  return (
    <div className="bg-surface shadow rounded-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text-primary">
            Endpoints for{' '}
            <span className="text-accent">{moduleName}</span>
          </h3>
          <p className="text-sm text-text-muted mt-1">
            {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-muted transition-colors"
        >
          <span className="sr-only">Close</span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-tertiary rounded animate-pulse" />
            ))}
          </div>
        ) : endpoints.length === 0 ? (
          <EmptyState title="No endpoints found" description="No endpoints found for this module." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    Errors
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    Avg Time
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    P95
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    P99
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border-subtle">
                {endpoints.map((endpoint: InboundEndpointStats, index: number) => (
                  <tr key={`${endpoint.method}-${endpoint.endpoint_pattern}-${index}`} className="hover:bg-surface-secondary">
                    <td className="px-4 py-3 text-sm">
                      <span className="font-mono text-text-primary truncate max-w-xs block" title={endpoint.endpoint_pattern}>
                        {endpoint.endpoint_pattern}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          getMethodBadgeColor(endpoint.method)
                        )}
                      >
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-text-primary font-medium">
                      {endpoint.total_requests.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          getSuccessRateBadgeColor(endpoint.success_rate),
                          getSuccessRateColor(endpoint.success_rate)
                        )}
                      >
                        {endpoint.success_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className={cn(
                      'px-4 py-3 text-sm text-right font-medium',
                      endpoint.error_count > 0 ? 'text-status-danger' : 'text-status-success'
                    )}>
                      {endpoint.error_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-text-secondary">
                      {formatResponseTime(endpoint.avg_response_time_ms)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-text-secondary">
                      {formatResponseTime(endpoint.p95_response_time_ms)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-text-secondary">
                      {formatResponseTime(endpoint.p99_response_time_ms)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onViewLogs(moduleName, endpoint.endpoint_pattern, endpoint.method)}
                        className="inline-flex items-center px-2.5 py-1.5 border border-border-primary shadow-sm text-xs font-medium rounded text-text-secondary bg-surface hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
