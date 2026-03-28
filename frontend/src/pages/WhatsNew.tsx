import { useState } from 'react'
import { Badge } from '@/components/ui'
import { changelog, type ChangeType } from '@/data/changelog'
import { ChevronDown, Sparkles } from 'lucide-react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info'

const changeTypeVariant: Record<ChangeType, { variant: BadgeVariant; label: string }> = {
  added: { variant: 'success', label: 'Added' },
  changed: { variant: 'info', label: 'Changed' },
  fixed: { variant: 'warning', label: 'Fixed' },
  removed: { variant: 'danger', label: 'Removed' },
  breaking: { variant: 'danger', label: 'Breaking' },
}

const INITIAL_SHOW = 3

export default function WhatsNew() {
  const [showAll, setShowAll] = useState(false)
  const visibleEntries = showAll ? changelog : changelog.slice(0, INITIAL_SHOW)
  const hasMore = changelog.length > INITIAL_SHOW

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10">
          <Sparkles className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">What's New</h1>
          <p className="text-sm text-text-muted">
            Platform changelog — all notable changes to SidMonitor.
          </p>
        </div>
      </div>

      <div className="relative mt-8">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-0 w-px bg-border-primary" />

        <div className="space-y-10">
          {visibleEntries.map((entry, idx) => (
            <div key={entry.version} className="relative pl-8">
              {/* Timeline dot */}
              <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 ${
                idx === 0 ? 'border-accent bg-accent/20' : 'border-accent bg-surface'
              }`} />

              {/* Version header */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold ${
                  idx === 0 ? 'bg-accent text-white' : 'bg-surface-tertiary text-text-primary'
                }`}>
                  v{entry.version}
                </span>
                <span className="text-sm text-text-muted">
                  {entry.date}
                </span>
                {idx === 0 && (
                  <span className="text-[11px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    Latest
                  </span>
                )}
              </div>

              <h2 className="text-lg font-semibold mb-4 text-text-primary">
                {entry.title}
              </h2>

              {/* Changes list */}
              <ul className="space-y-2.5">
                {entry.changes.map((change, i) => {
                  const { variant, label } = changeTypeVariant[change.type]
                  return (
                    <li key={`${change.type}-${i}`} className="flex items-start gap-2.5">
                      <Badge variant={variant} className="uppercase tracking-wide font-semibold flex-shrink-0">
                        {label}
                      </Badge>
                      <span className="text-sm leading-relaxed text-text-secondary">
                        {change.text}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Show more / less */}
        {hasMore && (
          <div className="relative pl-8 mt-8">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[15px] h-[15px] rounded-full border-2 border-border-primary bg-surface-secondary flex items-center justify-center">
              <ChevronDown className={`w-2.5 h-2.5 text-text-muted transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </div>
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              {showAll
                ? 'Show recent only'
                : `Show ${changelog.length - INITIAL_SHOW} older ${changelog.length - INITIAL_SHOW === 1 ? 'release' : 'releases'}`
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
