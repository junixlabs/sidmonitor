import { useState, useCallback } from 'react'
import { Bookmark, Plus, X, Star, Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui'
import { useSavedViews, useCreateSavedView, useDeleteSavedView, useUpdateSavedView } from '@/hooks/useSavedViews'
import type { FilterParams, SavedView } from '@/types'

const VIEW_COLORS = [
  { value: 'blue', bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400', border: 'border-blue-400/30' },
  { value: 'green', bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-400/30' },
  { value: 'amber', bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-400/30' },
  { value: 'red', bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400', border: 'border-red-400/30' },
  { value: 'purple', bg: 'bg-purple-500/15', text: 'text-purple-400', dot: 'bg-purple-400', border: 'border-purple-400/30' },
  { value: 'cyan', bg: 'bg-cyan-500/15', text: 'text-cyan-400', dot: 'bg-cyan-400', border: 'border-cyan-400/30' },
]

function getColorClasses(color?: string) {
  return VIEW_COLORS.find(c => c.value === color) || VIEW_COLORS[0]
}

function describeFilters(filters: FilterParams): string {
  const parts: string[] = []
  if (filters.status) parts.push(filters.status)
  if (filters.is_outbound === true) parts.push('Outbound')
  if (filters.is_outbound === false) parts.push('Inbound')
  if (filters.endpoint) parts.push(`endpoint: ${filters.endpoint}`)
  if (filters.module) parts.push(`module: ${filters.module}`)
  if (filters.user) parts.push(`user: ${filters.user}`)
  return parts.length > 0 ? parts.join(' · ') : 'No filters'
}

interface SavedViewsBarProps {
  currentFilters: FilterParams
  activeViewId: string | null
  onApplyView: (filters: FilterParams, viewId: string) => void
  onClearView: () => void
}

export default function SavedViewsBar({
  currentFilters,
  activeViewId,
  onApplyView,
  onClearView,
}: SavedViewsBarProps) {
  const { data: views = [] } = useSavedViews()
  const createView = useCreateSavedView()
  const deleteView = useDeleteSavedView()
  const updateView = useUpdateSavedView()

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [viewName, setViewName] = useState('')
  const [viewColor, setViewColor] = useState('blue')
  const [isDefault, setIsDefault] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const hasActiveFilters = !!(
    currentFilters.status ||
    currentFilters.endpoint ||
    currentFilters.module ||
    currentFilters.user ||
    currentFilters.request_id ||
    currentFilters.is_outbound !== undefined
  )

  const handleSave = useCallback(() => {
    if (!viewName.trim()) return
    // Strip pagination from saved filters
    const { page, page_size, ...filterData } = currentFilters
    createView.mutate(
      { name: viewName.trim(), filters: filterData, color: viewColor, is_default: isDefault },
      {
        onSuccess: () => {
          setShowSaveModal(false)
          setViewName('')
          setViewColor('blue')
          setIsDefault(false)
        },
      }
    )
  }, [viewName, currentFilters, viewColor, isDefault, createView])

  const handleDelete = useCallback((id: string) => {
    deleteView.mutate(id, {
      onSuccess: () => {
        setConfirmDeleteId(null)
        if (activeViewId === id) {
          onClearView()
        }
      },
    })
  }, [deleteView, activeViewId, onClearView])

  const handleSetDefault = useCallback((view: SavedView) => {
    updateView.mutate({
      viewId: view.id,
      data: { is_default: !view.is_default },
    })
  }, [updateView])

  if (views.length === 0 && !hasActiveFilters) return null

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-text-muted mr-1">
          <Bookmark className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Views</span>
        </div>

        {views.map((view) => {
          const colors = getColorClasses(view.color)
          const isActive = activeViewId === view.id

          return (
            <div key={view.id} className="relative group">
              <button
                onClick={() => {
                  if (isActive) {
                    onClearView()
                  } else {
                    onApplyView(view.filters, view.id)
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
                  isActive
                    ? `${colors.bg} ${colors.text} ${colors.border} ring-1 ring-current/20`
                    : 'bg-surface border-border-primary text-text-secondary hover:bg-surface-secondary'
                )}
                title={describeFilters(view.filters)}
              >
                <span className={cn('w-2 h-2 rounded-full', isActive ? colors.dot : 'bg-text-muted/40')} />
                {view.name}
                {view.is_default && (
                  <Star className="w-3 h-3 fill-current" />
                )}
              </button>

              {/* Action buttons on hover */}
              <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); handleSetDefault(view) }}
                  className={cn(
                    'p-0.5 rounded-full transition-colors',
                    view.is_default
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-surface-secondary text-text-muted hover:text-amber-400'
                  )}
                  title={view.is_default ? 'Remove default' : 'Set as default'}
                >
                  <Star className="w-3 h-3" />
                </button>
                {confirmDeleteId === view.id ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(view.id) }}
                    className="p-0.5 rounded-full bg-status-error/20 text-status-error"
                    title="Confirm delete"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(view.id) }}
                    className="p-0.5 rounded-full bg-surface-secondary text-text-muted hover:text-status-error"
                    title="Delete view"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {hasActiveFilters && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border border-dashed border-border-primary text-text-muted hover:text-accent hover:border-accent transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Save View
          </button>
        )}

        {activeViewId && (
          <button
            onClick={onClearView}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Save View Modal */}
      <Modal open={showSaveModal} onClose={() => setShowSaveModal(false)} title="Save Current Filters" size="sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="view-name" className="block text-sm font-medium text-text-secondary mb-1">
              View Name
            </label>
            <input
              id="view-name"
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="e.g. Production Errors, Auth Endpoints..."
              className="w-full px-3 py-2 text-sm border border-border-primary rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {VIEW_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setViewColor(c.value)}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center transition-all',
                    c.dot,
                    viewColor === c.value ? 'ring-2 ring-offset-2 ring-offset-surface ring-current scale-110' : 'opacity-60 hover:opacity-100'
                  )}
                >
                  {viewColor === c.value && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Active Filters
            </label>
            <p className="text-xs text-text-muted bg-surface-secondary rounded-lg px-3 py-2">
              {describeFilters(currentFilters)}
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-border-primary text-accent focus:ring-accent"
            />
            <span className="text-sm text-text-secondary">Set as default view</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowSaveModal(false)}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!viewName.trim() || createView.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {createView.isPending ? 'Saving...' : 'Save View'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
