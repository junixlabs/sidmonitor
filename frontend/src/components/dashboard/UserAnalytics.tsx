import { useState } from 'react'
import { formatNumber, formatPercentage, formatResponseTime } from '../../utils/format'
import { EmptyState } from '@/components/ui'
import { useTopUsers, useUsersWithErrors } from '../../hooks/useLogs'
import UserDetailModal from './UserDetailModal'
import type { UserStats, UserWithErrors } from '../../types'

// Common user type for modal
type UserForModal = {
  user_id: string
  user_name?: string
  total_requests: number
  error_count: number
  error_rate: number
  avg_response_time?: number
}

type SortField = 'total_requests' | 'error_count' | 'error_rate' | 'avg_response_time'
type SortDirection = 'asc' | 'desc'

export default function UserAnalytics() {
  const { data: topUsers, isLoading: topUsersLoading } = useTopUsers(10)
  const { data: usersWithErrors, isLoading: errorsLoading } = useUsersWithErrors(5)
  const [sortField, setSortField] = useState<SortField>('total_requests')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedUser, setSelectedUser] = useState<UserForModal | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleUserClick = (user: UserStats | UserWithErrors) => {
    setSelectedUser(user)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedUser(null)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedUsers = [...(topUsers || [])].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    const modifier = sortDirection === 'asc' ? 1 : -1
    return (aValue - bValue) * modifier
  })

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  const getErrorRateColor = (errorRate: number) => {
    if (errorRate < 5) return 'text-status-success'
    if (errorRate <= 20) return 'text-status-warning'
    return 'text-status-danger'
  }

  return (
    <div className="space-y-6">
      {/* Top Users Table */}
      <div className="bg-surface shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h2 className="text-lg font-medium text-text-primary">Top Users by Activity</h2>
          <p className="mt-1 text-sm text-text-muted">Users sorted by request volume and performance</p>
        </div>
        <div className="overflow-x-auto">
          {topUsersLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-tertiary animate-pulse rounded" />
              ))}
            </div>
          ) : sortedUsers && sortedUsers.length > 0 ? (
            <table className="min-w-full divide-y divide-border-subtle">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    User
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-tertiary"
                    onClick={() => handleSort('total_requests')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Total Requests</span>
                      {getSortIcon('total_requests')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-tertiary"
                    onClick={() => handleSort('error_count')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Errors</span>
                      {getSortIcon('error_count')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-tertiary"
                    onClick={() => handleSort('error_rate')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Error Rate</span>
                      {getSortIcon('error_rate')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-tertiary"
                    onClick={() => handleSort('avg_response_time')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Avg Response Time</span>
                      {getSortIcon('avg_response_time')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border-subtle">
                {sortedUsers.map((user, index) => (
                  <tr
                    key={index}
                    className="hover:bg-accent/5 cursor-pointer transition-colors"
                    onClick={() => handleUserClick(user)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-accent">
                            {user.user_name?.charAt(0).toUpperCase() || user.user_id.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-text-primary">
                            {user.user_name || 'Unknown'}
                          </div>
                          <div className="text-sm text-text-muted font-mono">
                            {user.user_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-primary">{formatNumber(user.total_requests)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-primary">{formatNumber(user.error_count)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getErrorRateColor(user.error_rate)}`}>
                        {formatPercentage(user.error_rate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-primary">{formatResponseTime(user.avg_response_time)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No user data available" />
          )}
        </div>
      </div>

      {/* Users with High Error Rates */}
      <div className="bg-surface shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h2 className="text-lg font-medium text-text-primary">Users with High Error Rates</h2>
          <p className="mt-1 text-sm text-text-muted">Users experiencing above-average error rates</p>
        </div>
        <div className="p-6">
          {errorsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-surface-tertiary animate-pulse rounded" />
              ))}
            </div>
          ) : usersWithErrors && usersWithErrors.length > 0 ? (
            <div className="space-y-3">
              {usersWithErrors.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-border-subtle rounded-lg hover:border-accent/30 hover:bg-accent/5 cursor-pointer transition-colors"
                  onClick={() => handleUserClick(user)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-status-danger/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-status-danger">
                        {user.user_name?.charAt(0).toUpperCase() || user.user_id.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">
                        {user.user_name || 'Unknown User'}
                      </div>
                      <div className="text-xs text-text-muted font-mono">
                        {user.user_id}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-xs text-text-muted">Total Requests</div>
                      <div className="text-sm font-medium text-text-primary">
                        {formatNumber(user.total_requests)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-muted">Errors</div>
                      <div className="text-sm font-medium text-text-primary">
                        {formatNumber(user.error_count)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-muted">Error Rate</div>
                      <div className={`text-sm font-semibold ${getErrorRateColor(user.error_rate)}`}>
                        {formatPercentage(user.error_rate)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-text-muted py-8">
              <svg className="mx-auto h-12 w-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2">No users with high error rates detected</p>
            </div>
          )}
        </div>
      </div>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </div>
  )
}
