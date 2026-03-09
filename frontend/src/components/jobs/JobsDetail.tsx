import { useState, useCallback } from 'react'
import { useJobs } from '../../hooks/useJobs'
import { formatDuration, formatDate } from '../../utils/format'
import { ErrorAlert, DetailsModal } from '@/components/ui'
import type { DetailField } from '@/components/ui'
import type { JobFilterParams, JobLog, JobStatus } from '../../types'

const DEFAULT_PAGE_SIZE = 20

const statusColors: Record<JobStatus, string> = {
  started: 'bg-status-info/10 text-status-info',
  completed: 'bg-status-success/10 text-status-success',
  failed: 'bg-status-danger/10 text-status-danger',
  retrying: 'bg-status-warning/10 text-status-warning',
}

function buildDetailFields(job: JobLog, colors: Record<JobStatus, string>): DetailField[] {
  return [
    { label: 'Job ID', value: <span className="font-mono">{job.job_id}</span> },
    { label: 'UUID', value: <span className="font-mono text-xs">{job.job_uuid}</span> },
    { label: 'Job Name', value: job.job_name },
    { label: 'Queue', value: job.queue_name },
    { label: 'Connection', value: job.connection },
    {
      label: 'Status',
      value: (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colors[job.status]}`}>
          {job.status}
        </span>
      ),
    },
    { label: 'Attempt', value: `${job.attempt_number} / ${job.max_attempts}` },
    { label: 'Started At', value: formatDate(job.started_at) },
    { label: 'Completed At', value: formatDate(job.completed_at!), hidden: !job.completed_at },
    { label: 'Duration', value: formatDuration(job.duration_ms!), hidden: !job.duration_ms },
    { label: 'Memory Usage', value: `${job.memory_usage_mb!.toFixed(2)} MB`, hidden: !job.memory_usage_mb },
    { label: 'Exception', value: <span className="text-status-danger font-mono">{job.exception_class}</span>, colSpan: 2, hidden: !job.exception_class },
    { label: 'Message', value: <span className="text-status-danger">{job.exception_message}</span>, colSpan: 2, hidden: !job.exception_class },
    {
      label: 'Stack Trace',
      value: (
        <span className="text-xs text-text-secondary font-mono bg-surface-secondary p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap block">
          {job.exception_trace}
        </span>
      ),
      colSpan: 2,
      hidden: !job.exception_trace,
    },
  ]
}

interface JobsDetailProps {
  jobClass: string
  onBack: () => void
}

export default function JobsDetail({ jobClass, onBack }: JobsDetailProps) {
  const [filters, setFilters] = useState<Omit<JobFilterParams, 'project_id'>>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    job_class: jobClass,
  })
  const [selectedJob, setSelectedJob] = useState<JobLog | null>(null)

  const { data: jobsData, isLoading: jobsLoading, error: jobsError } = useJobs(filters)

  const handleFilterChange = useCallback((key: keyof JobFilterParams, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const totalPages = jobsData?.total_pages || 1
  const currentPage = filters.page || 1

  const jobName = jobClass.split('\\').pop() || jobClass

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-accent hover:text-accent-hover flex items-center mb-2"
          >
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Summary
          </button>
          <h2 className="text-2xl font-semibold text-text-primary">{jobName}</h2>
          <p className="text-sm text-text-muted font-mono">{jobClass}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="block w-full rounded-md border-border-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm"
            >
              <option value="">All Statuses</option>
              <option value="started">Started</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="retrying">Retrying</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date || ''}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="block w-full rounded-md border-border-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date || ''}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="block w-full rounded-md border-border-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm"
            />
          </div>
        </div>
      </div>

      {jobsError && (
        <ErrorAlert message="Failed to load jobs" description="Please check your connection." className="mb-4" />
      )}

      {/* Jobs Table */}
      <div className="bg-surface shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">Execution History</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Job ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Attempt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Started At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border-subtle">
                {jobsLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-4">
                        <div className="h-4 bg-surface-tertiary animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : jobsData?.data && jobsData.data.length > 0 ? (
                  jobsData.data.map((job) => (
                    <tr
                      key={job.job_id}
                      onClick={() => setSelectedJob(job)}
                      className="hover:bg-surface-secondary cursor-pointer"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-text-primary">{job.job_id}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[job.status]}`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                        {job.duration_ms ? formatDuration(job.duration_ms) : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                        {job.attempt_number}/{job.max_attempts}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                        {formatDate(job.started_at)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-status-danger truncate max-w-xs">
                        {job.exception_message || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      No executions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {jobsData && jobsData.total > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-4">
              <div className="text-sm text-text-secondary">
                Showing{' '}
                <span className="font-medium">
                  {(currentPage - 1) * DEFAULT_PAGE_SIZE + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * DEFAULT_PAGE_SIZE, jobsData.total)}
                </span>{' '}
                of <span className="font-medium">{jobsData.total}</span> results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || jobsLoading}
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
                  disabled={currentPage === totalPages || jobsLoading}
                  className="relative inline-flex items-center px-4 py-2 border border-border-primary text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Job Details Modal */}
      <DetailsModal
        title="Job Details"
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        fields={selectedJob ? buildDetailFields(selectedJob, statusColors) : []}
      />
    </div>
  )
}
