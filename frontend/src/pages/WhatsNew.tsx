import { Badge } from '@/components/ui'
import { changelog, type ChangeType } from '@/data/changelog'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info'

const changeTypeVariant: Record<ChangeType, { variant: BadgeVariant; label: string }> = {
  added: { variant: 'success', label: 'Added' },
  changed: { variant: 'info', label: 'Changed' },
  fixed: { variant: 'warning', label: 'Fixed' },
  removed: { variant: 'danger', label: 'Removed' },
  breaking: { variant: 'danger', label: 'Breaking' },
}

export default function WhatsNew() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-1 text-text-primary">
        What's New
      </h1>
      <p className="mb-8 text-sm text-text-muted">
        Platform changelog — all notable changes to SidMonitor.
      </p>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-0 w-px bg-border-primary" />

        <div className="space-y-10">
          {changelog.map((entry) => (
            <div key={entry.version} className="relative pl-8">
              {/* Timeline dot */}
              <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-accent bg-surface" />

              {/* Version header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-accent text-white">
                  v{entry.version}
                </span>
                <span className="text-sm text-text-muted">
                  {entry.date}
                </span>
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
      </div>
    </div>
  )
}
