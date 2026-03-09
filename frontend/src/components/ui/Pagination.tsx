import { cn } from '@/lib/utils'
import { formatCount } from '@/utils/format'
import { PAGE_SIZE_OPTIONS } from '@/utils/constants'

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
  loading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  loading,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  if (total <= 0) return null

  return (
    <div className={cn('mt-4 flex flex-col gap-4 border-t border-border-primary pt-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex items-center gap-4">
        <div className="text-sm text-text-secondary">
          Showing{' '}
          <span className="font-medium text-text-primary">
            {(currentPage - 1) * pageSize + 1}
          </span>{' '}
          to{' '}
          <span className="font-medium text-text-primary">
            {Math.min(currentPage * pageSize, total)}
          </span>{' '}
          of <span className="font-medium text-text-primary">{formatCount(total)}</span> results
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="pageSize" className="text-sm text-text-secondary">
            Per page:
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-border-primary bg-surface text-sm text-text-primary focus:border-accent focus:ring-accent"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          className="inline-flex items-center rounded-md border border-border-primary bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
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
          className="inline-flex items-center rounded-md border border-border-primary bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
