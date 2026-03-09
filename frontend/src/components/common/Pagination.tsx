import { formatCount } from '../../utils/format'
import { PAGE_SIZE_OPTIONS } from '../../utils/constants'

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
  loading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export default function Pagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  loading,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (total <= 0) return null

  return (
    <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border-subtle pt-4">
      <div className="flex items-center gap-4">
        <div className="text-sm text-text-secondary">
          Showing{' '}
          <span className="font-medium">
            {(currentPage - 1) * pageSize + 1}
          </span>{' '}
          to{' '}
          <span className="font-medium">
            {Math.min(currentPage * pageSize, total)}
          </span>{' '}
          of <span className="font-medium">{formatCount(total)}</span> results
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="pageSize" className="text-sm text-text-secondary">
            Per page:
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border-border-primary rounded-md text-sm focus:ring-accent focus:border-accent"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          className="relative inline-flex items-center px-4 py-2 border border-border-primary text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm text-text-secondary">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          className="relative inline-flex items-center px-4 py-2 border border-border-primary text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}
