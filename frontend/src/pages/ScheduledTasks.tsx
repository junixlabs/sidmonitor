import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import StatsCard from '../components/dashboard/StatsCard'
import { DetailsModal, ErrorAlert } from '@/components/ui'
import type { DetailField } from '@/components/ui'
import { useScheduledTasks, useScheduledTaskStats } from '../hooks/useJobs'
import type { ScheduledTaskFilterParams, ScheduledTaskLog, ScheduledTaskStatus } from '../types'
import cronstrue from 'cronstrue'
import * as cronParser from 'cron-parser'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { formatNumber, formatPercentage, formatResponseTime, formatDate } from '../utils/format'
import { DEFAULT_PAGE_SIZE } from '../utils/constants'

const statusColors: Record<ScheduledTaskStatus, string> = {
  scheduled: 'bg-surface-tertiary text-text-secondary',
  running: 'bg-status-info/10 text-status-info',
  completed: 'bg-status-success/10 text-status-success',
  failed: 'bg-status-danger/10 text-status-danger',
  skipped: 'bg-status-warning/10 text-status-warning',
  missed: 'bg-status-warning/10 text-status-warning',
}

export default function ScheduledTasks() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCommand = searchParams.get('command')

  const [filters, setFilters] = useState<Omit<ScheduledTaskFilterParams, 'project_id'>>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    command: selectedCommand || undefined,
  })
  const [selectedTask, setSelectedTask] = useState<ScheduledTaskLog | null>(null)

  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useScheduledTasks(filters)
  const { data: stats, isLoading: statsLoading } = useScheduledTaskStats('7d')

  const handleFilterChange = useCallback((key: keyof ScheduledTaskFilterParams, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const getHumanReadableCron = (expression: string) => {
    try {
      return cronstrue.toString(expression)
    } catch {
      return expression
    }
  }

  const getNextRun = (expression: string, timezone?: string) => {
    try {
      const options = timezone ? { tz: timezone } : {}
      const interval = cronParser.parseExpression(expression, options)
      const nextDate = interval.next().toDate()
      return {
        absolute: nextDate.toLocaleString(),
        relative: formatDistanceToNow(nextDate, { addSuffix: true })
      }
    } catch {
      return null
    }
  }

  const totalPages = tasksData?.total_pages || 1
  const currentPage = filters.page || 1

  // Navigate to detail view
  const handleViewDetails = useCallback((command: string) => {
    setSearchParams({ command })
    setFilters({ page: 1, page_size: DEFAULT_PAGE_SIZE, command })
  }, [setSearchParams])

  // Navigate back to summary
  const handleBackToSummary = useCallback(() => {
    setSearchParams({})
    setFilters({ page: 1, page_size: DEFAULT_PAGE_SIZE })
  }, [setSearchParams])

  // Get summary data from stats
  const summaryData = useMemo(() => {
    if (!stats?.by_command) return []

    return stats.by_command.map((cmd) => {
      // Find the most recent execution for this command from all tasks
      const recentExecution = tasksData?.data?.find((t) => t.command === cmd.command)

      return {
        command: cmd.command,
        expression: recentExecution?.expression || '',
        timezone: recentExecution?.timezone || 'UTC',
        lastRunTime: recentExecution?.completed_at || recentExecution?.started_at || recentExecution?.scheduled_at,
        lastStatus: recentExecution?.status,
        totalExecutions: cmd.total_executions,
        successRate: cmd.total_executions > 0 ? (cmd.success_count / cmd.total_executions) * 100 : 0,
        avgDuration: cmd.avg_duration_ms,
      }
    })
  }, [stats, tasksData])

  // Calculate detail view stats
  const detailStats = useMemo(() => {
    if (!selectedCommand || !stats?.by_command) return null

    const commandStats = stats.by_command.find((c) => c.command === selectedCommand)
    if (!commandStats) return null

    return {
      successRate: commandStats.total_executions > 0
        ? (commandStats.success_count / commandStats.total_executions) * 100
        : 0,
      avgDuration: commandStats.avg_duration_ms,
      totalExecutions: commandStats.total_executions,
      failureCount: commandStats.failure_count,
    }
  }, [selectedCommand, stats])

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Scheduled Tasks</h1>

      {selectedCommand ? (
        /* Detail View */
        <>
          {/* Back Button */}
          <div className="mb-6">
            <button
              type="button"
              onClick={handleBackToSummary}
              className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Summary
            </button>
          </div>

          {/* Detail Stats Cards */}
          <div className="mb-6">
            <h2 className="text-lg font-medium text-text-primary mb-4">
              Execution History: <span className="font-mono text-accent">{selectedCommand}</span>
            </h2>
            {detailStats && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                  title="Total Executions"
                  value={formatNumber(detailStats.totalExecutions)}
                  color="indigo"
                  loading={statsLoading}
                />
                <StatsCard
                  title="Success Rate"
                  value={formatPercentage(detailStats.successRate)}
                  color="green"
                  loading={statsLoading}
                />
                <StatsCard
                  title="Avg Duration"
                  value={formatResponseTime(detailStats.avgDuration)}
                  color="blue"
                  loading={statsLoading}
                />
                <StatsCard
                  title="Failures"
                  value={formatNumber(detailStats.failureCount)}
                  color="red"
                  loading={statsLoading}
                />
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="bg-surface shadow rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Status</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="block w-full rounded-md border-border-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="skipped">Skipped</option>
                  <option value="missed">Missed</option>
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

          {tasksError && <ErrorAlert message="Failed to load scheduled tasks" description="Please check your connection." className="mb-4" />}

          {/* Execution History Table */}
          <div className="bg-surface shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border-subtle">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Scheduled At
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Exit Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-border-subtle">
                    {tasksLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={5} className="px-4 py-4">
                            <div className="h-4 bg-surface-tertiary animate-pulse rounded" />
                          </td>
                        </tr>
                      ))
                    ) : tasksData?.data && tasksData.data.length > 0 ? (
                      tasksData.data.map((task) => (
                        <tr
                          key={task.task_id}
                          onClick={() => setSelectedTask(task)}
                          className="hover:bg-surface-secondary cursor-pointer"
                        >
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-text-primary">
                            {formatDate(task.scheduled_at)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[task.status]}`}
                            >
                              {task.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                            {task.duration_ms ? formatResponseTime(task.duration_ms) : '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                            {task.exit_code !== undefined ? task.exit_code : '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-status-danger truncate max-w-xs">
                            {task.error_message || '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                          No execution history found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {tasksData && tasksData.total > 0 && (
                <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-4">
                  <div className="text-sm text-text-secondary">
                    Showing{' '}
                    <span className="font-medium">
                      {(currentPage - 1) * DEFAULT_PAGE_SIZE + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * DEFAULT_PAGE_SIZE, tasksData.total)}
                    </span>{' '}
                    of <span className="font-medium">{tasksData.total}</span> results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || tasksLoading}
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
                      disabled={currentPage === totalPages || tasksLoading}
                      className="relative inline-flex items-center px-4 py-2 border border-border-primary text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Summary View */
        <>
          {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatsCard
              title="Total Executions"
              value={formatNumber(stats?.total_executions)}
              color="indigo"
              loading={statsLoading}
            />
            <StatsCard
              title="Active Schedules"
              value={formatNumber(stats?.by_command?.length)}
              color="indigo"
              loading={statsLoading}
            />
            <StatsCard
              title="Success Rate"
              value={formatPercentage(stats?.success_rate)}
              color="green"
              loading={statsLoading}
            />
            <StatsCard
              title="Missed Tasks"
              value={formatNumber(stats?.missed_count)}
              color="yellow"
              loading={statsLoading}
            />
          </div>

          {tasksError && <ErrorAlert message="Failed to load scheduled tasks" description="Please check your connection." className="mb-4" />}

          {/* Summary Table */}
          <div className="bg-surface shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border-subtle">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Command
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Schedule
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Last Run
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Last Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Next Run
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Success Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-border-subtle">
                    {statsLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="px-4 py-4">
                            <div className="h-4 bg-surface-tertiary animate-pulse rounded" />
                          </td>
                        </tr>
                      ))
                    ) : summaryData.length > 0 ? (
                      summaryData.map((item) => {
                        const nextRun = item.expression ? getNextRun(item.expression, item.timezone) : null
                        return (
                          <tr
                            key={item.command}
                            onClick={() => handleViewDetails(item.command)}
                            className="hover:bg-surface-secondary cursor-pointer"
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-text-primary font-mono">{item.command}</div>
                              <div className="text-xs text-text-muted">{item.totalExecutions} total executions</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {item.expression ? (
                                <>
                                  <div className="text-sm text-text-primary" title={item.expression}>
                                    {getHumanReadableCron(item.expression)}
                                  </div>
                                  <div className="text-xs text-text-muted font-mono">{item.expression}</div>
                                </>
                              ) : (
                                <div className="text-sm text-text-muted">-</div>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-text-muted">
                              {item.lastRunTime ? formatDate(item.lastRunTime) : '-'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {item.lastStatus ? (
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[item.lastStatus]}`}
                                >
                                  {item.lastStatus}
                                </span>
                              ) : (
                                <span className="text-sm text-text-muted">-</span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {nextRun ? (
                                <div>
                                  <div className="text-sm text-text-primary">{nextRun.relative}</div>
                                  <div className="text-xs text-text-muted">{nextRun.absolute}</div>
                                </div>
                              ) : (
                                <div className="text-sm text-text-muted">-</div>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-text-primary">{formatPercentage(item.successRate)}</div>
                              <div className="text-xs text-text-muted">{formatResponseTime(item.avgDuration)} avg</div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                          No scheduled tasks found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Task Details Modal */}
      <DetailsModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title="Task Details"
        fields={selectedTask ? [
          { label: 'Task ID', value: <span className="font-mono">{selectedTask.task_id}</span> },
          { label: 'Status', value: (
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[selectedTask.status]}`}>
              {selectedTask.status}
            </span>
          ) },
          { label: 'Command', value: <span className="font-mono">{selectedTask.command}</span>, colSpan: 2 },
          { label: 'Description', value: selectedTask.description, hidden: !selectedTask.description, colSpan: 2 },
          { label: 'Schedule', value: <span className="font-mono">{selectedTask.expression}</span> },
          { label: 'Timezone', value: selectedTask.timezone },
          { label: 'Scheduled At', value: formatDate(selectedTask.scheduled_at) },
          { label: 'Started At', value: selectedTask.started_at ? formatDate(selectedTask.started_at) : null, hidden: !selectedTask.started_at },
          { label: 'Completed At', value: selectedTask.completed_at ? formatDate(selectedTask.completed_at) : null, hidden: !selectedTask.completed_at },
          { label: 'Duration', value: selectedTask.duration_ms ? formatResponseTime(selectedTask.duration_ms) : null, hidden: !selectedTask.duration_ms },
          { label: 'Delay', value: selectedTask.delay_ms !== undefined ? formatResponseTime(selectedTask.delay_ms) : null, hidden: selectedTask.delay_ms === undefined },
          { label: 'Exit Code', value: selectedTask.exit_code, hidden: selectedTask.exit_code === undefined },
          { label: 'Without Overlapping', value: selectedTask.without_overlapping ? 'Yes' : 'No' },
          { label: 'Mutex', value: <span className="font-mono text-xs">{selectedTask.mutex_name}</span>, hidden: !selectedTask.mutex_name },
          { label: 'Output', value: selectedTask.output ? (
            <div className="text-xs text-text-secondary font-mono bg-surface-secondary p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
              {selectedTask.output}
            </div>
          ) : null, hidden: !selectedTask.output, colSpan: 2 },
          { label: 'Error', value: <span className="text-status-danger">{selectedTask.error_message}</span>, hidden: !selectedTask.error_message, colSpan: 2 },
          { label: 'Error Trace', value: selectedTask.error_trace ? (
            <div className="text-xs text-text-secondary font-mono bg-surface-secondary p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
              {selectedTask.error_trace}
            </div>
          ) : null, hidden: !selectedTask.error_trace, colSpan: 2 },
        ] as DetailField[] : []}
      />
    </div>
  )
}
