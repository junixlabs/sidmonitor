import { useState, useCallback, useEffect } from 'react'
import type { FilterParams } from '../../types'

interface FilterPanelProps {
  filters: FilterParams
  onFilterChange: (filters: FilterParams) => void
  modules: string[]
  loading?: boolean
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: '2xx', label: '2xx Success' },
  { value: '4xx', label: '4xx Client Error' },
  { value: '5xx', label: '5xx Server Error' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'inbound', label: 'Inbound Only' },
  { value: 'outbound', label: 'Outbound Only' },
]

export default function FilterPanel({
  filters,
  onFilterChange,
  modules,
  loading = false,
}: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<FilterParams>(filters)

  // Sync local state when parent filters change (e.g. from saved views)
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const handleChange = useCallback(
    (key: keyof FilterParams, value: string) => {
      const newFilters = { ...localFilters, [key]: value || undefined, page: 1 }
      setLocalFilters(newFilters)
      onFilterChange(newFilters)
    },
    [localFilters, onFilterChange]
  )

  const handleTypeChange = useCallback(
    (value: string) => {
      const newFilters = {
        ...localFilters,
        is_outbound: value === 'outbound' ? true : value === 'inbound' ? false : undefined,
        page: 1
      }
      setLocalFilters(newFilters)
      onFilterChange(newFilters)
    },
    [localFilters, onFilterChange]
  )

  const getTypeFilterValue = () => {
    if (localFilters.is_outbound === true) return 'outbound'
    if (localFilters.is_outbound === false) return 'inbound'
    return ''
  }

  const handleReset = useCallback(() => {
    const resetFilters: FilterParams = { page: 1, page_size: filters.page_size }
    setLocalFilters(resetFilters)
    onFilterChange(resetFilters)
  }, [filters.page_size, onFilterChange])

  return (
    <div className="bg-surface shadow rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
        <div>
          <label
            htmlFor="status-filter"
            className="block text-sm font-medium text-text-secondary"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={localFilters.status || ''}
            onChange={(e) => handleChange('status', e.target.value)}
            disabled={loading}
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
          <label
            htmlFor="type-filter"
            className="block text-sm font-medium text-text-secondary"
          >
            Type
          </label>
          <select
            id="type-filter"
            value={getTypeFilterValue()}
            onChange={(e) => handleTypeChange(e.target.value)}
            disabled={loading}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="endpoint-filter"
            className="block text-sm font-medium text-text-secondary"
          >
            Endpoint
          </label>
          <input
            id="endpoint-filter"
            type="text"
            placeholder="Filter by endpoint..."
            value={localFilters.endpoint || ''}
            onChange={(e) => handleChange('endpoint', e.target.value)}
            disabled={loading}
            className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
          />
        </div>

        <div>
          <label
            htmlFor="module-filter"
            className="block text-sm font-medium text-text-secondary"
          >
            Module
          </label>
          <select
            id="module-filter"
            value={localFilters.module || ''}
            onChange={(e) => handleChange('module', e.target.value)}
            disabled={loading}
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
          <label
            htmlFor="user-filter"
            className="block text-sm font-medium text-text-secondary"
          >
            User
          </label>
          <input
            id="user-filter"
            type="text"
            placeholder="Filter by user..."
            value={localFilters.user || ''}
            onChange={(e) => handleChange('user', e.target.value)}
            disabled={loading}
            className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
          />
        </div>

        <div>
          <label
            htmlFor="request-id-filter"
            className="block text-sm font-medium text-text-secondary"
          >
            Request ID
          </label>
          <input
            id="request-id-filter"
            type="text"
            placeholder="Filter by request ID..."
            value={localFilters.request_id || ''}
            onChange={(e) => handleChange('request_id', e.target.value)}
            disabled={loading}
            className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border disabled:bg-surface-tertiary"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="w-full inline-flex justify-center py-2 px-4 border border-border-primary shadow-sm text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:bg-surface-tertiary"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  )
}
