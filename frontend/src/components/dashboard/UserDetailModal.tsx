import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useUserActivity } from '../../hooks/useLogs'
import { formatNumber, formatPercentage, formatResponseTime } from '../../utils/format'

// User type that works for both UserStats and UserWithErrors
interface UserInfo {
  user_id: string
  user_name?: string
  total_requests: number
  error_count: number
  error_rate: number
  avg_response_time?: number
}

interface UserDetailModalProps {
  user: UserInfo | null
  isOpen: boolean
  onClose: () => void
}

export default function UserDetailModal({ user, isOpen, onClose }: UserDetailModalProps) {
  const { data: activity, isLoading: activityLoading } = useUserActivity(
    user?.user_id || '',
    { interval: 'hour' }
  )

  const getErrorRateColor = (errorRate: number) => {
    if (errorRate < 5) return 'text-status-success'
    if (errorRate <= 20) return 'text-status-warning'
    return 'text-status-danger'
  }

  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-surface text-left align-middle shadow-xl transition-all">
                {user && (
                  <>
                    {/* Header */}
                    <div className="px-6 py-4 bg-surface-secondary border-b border-border-subtle">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                            <span className="text-lg font-semibold text-accent">
                              {user.user_name?.charAt(0).toUpperCase() || user.user_id.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <Dialog.Title as="h3" className="text-lg font-medium text-text-primary">
                              {user.user_name || 'Unknown User'}
                            </Dialog.Title>
                            <p className="text-sm text-text-muted font-mono">{user.user_id}</p>
                          </div>
                        </div>
                        <button
                          onClick={onClose}
                          className="text-text-muted hover:text-text-secondary transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="px-6 py-4 border-b border-border-subtle">
                      <div className={`grid gap-4 ${user.avg_response_time !== undefined ? 'grid-cols-4' : 'grid-cols-3'}`}>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-text-primary">
                            {formatNumber(user.total_requests)}
                          </div>
                          <div className="text-sm text-text-muted">Total Requests</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-text-primary">
                            {formatNumber(user.error_count)}
                          </div>
                          <div className="text-sm text-text-muted">Errors</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${getErrorRateColor(user.error_rate)}`}>
                            {formatPercentage(user.error_rate)}
                          </div>
                          <div className="text-sm text-text-muted">Error Rate</div>
                        </div>
                        {user.avg_response_time !== undefined && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-text-primary">
                              {formatResponseTime(user.avg_response_time)}
                            </div>
                            <div className="text-sm text-text-muted">Avg Response</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Activity Timeline */}
                    <div className="px-6 py-4">
                      <h4 className="text-sm font-medium text-text-primary mb-4">Activity Timeline (Last 24 Hours)</h4>
                      {activityLoading ? (
                        <div className="h-64 bg-surface-tertiary animate-pulse rounded" />
                      ) : activity && activity.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={activity}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="timestamp"
                                tickFormatter={formatXAxis}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip
                                labelFormatter={(value) => new Date(value).toLocaleString()}
                                formatter={(value: number, name: string) => [
                                  formatNumber(value),
                                  name === 'requests' ? 'Requests' : 'Errors'
                                ]}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="requests"
                                name="Requests"
                                stroke="#6366f1"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="errors"
                                name="Errors"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-text-muted">
                          <div className="text-center">
                            <svg className="mx-auto h-12 w-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="mt-2">No activity data available</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-surface-secondary border-t border-border-subtle">
                      <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-border-primary px-4 py-2 bg-surface text-sm font-medium text-text-secondary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
                        onClick={onClose}
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
