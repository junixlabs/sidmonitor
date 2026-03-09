import { formatCount } from '@/utils/format'
import { DashboardTab } from '../../types'

interface DashboardTabsProps {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  counts?: { all: number; inbound: number; outbound: number }
  loading?: boolean
}

export default function DashboardTabs({ activeTab, onTabChange, counts, loading }: DashboardTabsProps) {
  const tabs: { id: DashboardTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'inbound', label: 'Inbound' },
    { id: 'outbound', label: 'Outbound' },
  ]

  return (
    <div className="mb-6">
      <div className="flex space-x-1 bg-surface-tertiary p-1 rounded-lg inline-flex">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const count = counts?.[tab.id]

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
              }`}
              aria-selected={isActive}
              role="tab"
            >
              {tab.label}
              {!loading && count !== undefined && (
                <span
                  className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    isActive
                      ? 'bg-accent/80 text-white'
                      : 'bg-surface-tertiary text-text-secondary'
                  }`}
                >
                  {formatCount(count)}
                </span>
              )}
              {loading && (
                <span className="ml-2 px-2 py-0.5 text-xs">
                  <span className="inline-block w-4 h-3 bg-surface-tertiary animate-pulse rounded"></span>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
