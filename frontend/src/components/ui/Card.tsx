import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border-subtle bg-surface shadow-sm transition-colors',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  )
}
