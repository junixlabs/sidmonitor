import type { JobStats, JobSummary } from '../../types'
import { EmptyState } from '@/components/ui'
import { formatDuration, formatPercentage } from '../../utils/format'

interface JobsSummaryProps {
  stats: JobStats | undefined
  isLoading: boolean
  onJobClick: (jobClass: string) => void
}

export default function JobsSummary({ stats, isLoading, onJobClick }: JobsSummaryProps) {
  const getStatusColor = (successRate: number) => {
    if (successRate >= 95) return 'text-status-success'
    if (successRate >= 80) return 'text-status-warning'
    return 'text-status-danger'
  }

  // Aggregate data by job_class from stats
  const jobSummaries: JobSummary[] = stats?.by_job_class?.map((jobClass) => {
    const successRate = jobClass.total_executions > 0
      ? (jobClass.success_count / jobClass.total_executions) * 100
      : 0

    // Find last run info from recent failures or use a placeholder
    const lastFailure = stats.recent_failures?.find(f => f.job_class === jobClass.job_class)

    return {
      job_class: jobClass.job_class,
      job_name: jobClass.job_class.split('\\').pop() || jobClass.job_class,
      total_executions: jobClass.total_executions,
      success_count: jobClass.success_count,
      failure_count: jobClass.failure_count,
      success_rate: successRate,
      avg_duration_ms: jobClass.avg_duration_ms,
      last_run_at: lastFailure?.timestamp,
      last_status: lastFailure ? 'failed' : 'completed',
    }
  }) || []

  return (
    <div className="bg-surface shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Jobs Summary</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-subtle">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  Job Class
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  Total Runs
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  Avg Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  Last Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border-subtle">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-4">
                      <div className="h-4 bg-surface-tertiary animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              ) : jobSummaries.length > 0 ? (
                jobSummaries.map((job) => (
                  <tr
                    key={job.job_class}
                    onClick={() => onJobClick(job.job_class)}
                    className="hover:bg-surface-secondary cursor-pointer"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-primary">{job.job_name}</div>
                      <div className="text-xs text-text-muted font-mono truncate max-w-xs">
                        {job.job_class}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-primary">
                      {job.total_executions}
                      <div className="text-xs text-text-muted">
                        {job.success_count} success, {job.failure_count} failed
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getStatusColor(job.success_rate)}`}>
                        {formatPercentage(job.success_rate)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                      {formatDuration(job.avg_duration_ms)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          job.last_status === 'completed'
                            ? 'bg-status-success/10 text-status-success'
                            : 'bg-status-danger/10 text-status-danger'
                        }`}
                      >
                        {job.last_status || '-'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No jobs found" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
