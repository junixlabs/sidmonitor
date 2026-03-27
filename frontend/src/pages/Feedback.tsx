import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Bug, Star, Lightbulb, HelpCircle, Filter, Trash2 } from 'lucide-react'
import { feedbackApi } from '@/api/client'
import type { FeedbackEntry, FeedbackStatus, FeedbackCategory } from '@/types'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: 'bg-status-info/10 text-status-info',
  in_progress: 'bg-status-warning/10 text-status-warning',
  resolved: 'bg-status-success/10 text-status-success',
  closed: 'bg-text-muted/10 text-text-muted',
}

const CATEGORY_ICONS: Record<FeedbackCategory, React.ReactNode> = {
  bug: <Bug className="w-4 h-4 text-status-danger" />,
  feature: <Star className="w-4 h-4 text-accent" />,
  improvement: <Lightbulb className="w-4 h-4 text-status-warning" />,
  question: <HelpCircle className="w-4 h-4 text-status-info" />,
  other: <MessageSquare className="w-4 h-4 text-text-muted" />,
}

const PRIORITY_DOTS: Record<string, string> = {
  low: 'bg-text-muted',
  medium: 'bg-status-warning',
  high: 'bg-status-danger',
  critical: 'bg-red-600',
}

export default function Feedback() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', page, statusFilter, categoryFilter],
    queryFn: () => feedbackApi.list({
      page,
      per_page: 20,
      ...(statusFilter && { status: statusFilter }),
      ...(categoryFilter && { category: categoryFilter }),
    }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => feedbackApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] })
      toast.success('Status updated')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => feedbackApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] })
      toast.success('Feedback deleted')
    },
  })

  const handleStatusChange = (entry: FeedbackEntry, newStatus: string) => {
    updateMutation.mutate({ id: entry.id, status: newStatus })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Feedback & Issues</h1>
          <p className="text-sm text-text-muted mt-1">
            {data ? `${data.total} total entries` : 'Loading...'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-text-muted" />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="text-sm border border-border-primary rounded-md px-3 py-1.5 bg-surface text-text-primary"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
          className="text-sm border border-border-primary rounded-md px-3 py-1.5 bg-surface text-text-primary"
        >
          <option value="">All Categories</option>
          <option value="bug">Bug</option>
          <option value="feature">Feature</option>
          <option value="improvement">Improvement</option>
          <option value="question">Question</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Feedback list */}
      <div className="bg-surface rounded-lg border border-border-primary overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-muted">Loading feedback...</div>
        ) : data && data.items.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted">No feedback entries yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {data?.items.map((entry) => (
              <div key={entry.id} className="hover:bg-surface-secondary transition-colors">
                <div
                  className="px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{CATEGORY_ICONS[entry.category]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-text-primary truncate">{entry.title}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[entry.status]}`}>
                          {entry.status.replace('_', ' ')}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[entry.priority]}`} />
                          {entry.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                        {entry.user_name && <span>{entry.user_name}</span>}
                        <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                        <span className="capitalize">{entry.category}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === entry.id && (
                  <div className="px-5 pb-4 pl-12">
                    <p className="text-sm text-text-secondary whitespace-pre-wrap mb-3">{entry.description}</p>
                    {entry.page_url && (
                      <p className="text-xs text-text-muted mb-2">Page: {entry.page_url}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-text-muted">Set status:</span>
                      {(['open', 'in_progress', 'resolved', 'closed'] as FeedbackStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(entry, s) }}
                          disabled={entry.status === s}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            entry.status === s
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border-primary text-text-secondary hover:border-accent'
                          }`}
                        >
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(entry.id) }}
                        className="ml-auto p-1 text-text-muted hover:text-status-danger transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle bg-surface-secondary">
            <span className="text-xs text-text-muted">
              Page {data.page} of {Math.ceil(data.total / data.per_page)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-xs border border-border-primary rounded hover:bg-surface disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(data.total / data.per_page)}
                className="px-3 py-1 text-xs border border-border-primary rounded hover:bg-surface disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
