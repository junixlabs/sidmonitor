import { cn } from '@/lib/utils'

interface Tab {
  key: string
  label: string
  count?: number
}

interface TabNavProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
  className?: string
}

export function TabNav({ tabs, active, onChange, className }: TabNavProps) {
  return (
    <div className={cn('border-b border-border-primary', className)}>
      <nav className="-mb-px flex gap-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
              active === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:border-border-primary hover:text-text-secondary'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                'ml-2 rounded-full px-2 py-0.5 text-xs',
                active === tab.key
                  ? 'bg-accent/10 text-accent'
                  : 'bg-surface-tertiary text-text-muted'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
