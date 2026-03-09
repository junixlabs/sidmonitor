import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { EmptyState } from './EmptyState'
import { SkeletonRows } from './Skeleton'

interface TableProps {
  headers: string[]
  children: ReactNode
  loading?: boolean
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: ReactNode
  className?: string
}

export function Table({
  headers,
  children,
  loading,
  empty,
  emptyTitle = 'No data found',
  emptyDescription,
  emptyIcon,
  className,
}: TableProps) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border-subtle', className)}>
      <table className="min-w-full divide-y divide-border-subtle">
        <thead className="bg-surface-secondary">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-surface">
          {loading ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-4">
                <SkeletonRows rows={5} />
              </td>
            </tr>
          ) : empty ? (
            <tr>
              <td colSpan={headers.length}>
                <EmptyState
                  icon={emptyIcon}
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}
