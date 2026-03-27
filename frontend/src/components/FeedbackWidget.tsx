import { useState, useRef, useEffect } from 'react'
import { MessageSquarePlus, X, Bug, Lightbulb, HelpCircle, Star, Send } from 'lucide-react'
import { feedbackApi } from '@/api/client'
import type { FeedbackCategory, FeedbackPriority } from '@/types'
import { toast } from 'sonner'

const CATEGORIES: { value: FeedbackCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'bug', label: 'Bug Report', icon: <Bug className="w-4 h-4" />, color: 'text-status-danger' },
  { value: 'feature', label: 'Feature Request', icon: <Star className="w-4 h-4" />, color: 'text-accent' },
  { value: 'improvement', label: 'Improvement', icon: <Lightbulb className="w-4 h-4" />, color: 'text-status-warning' },
  { value: 'question', label: 'Question', icon: <HelpCircle className="w-4 h-4" />, color: 'text-status-info' },
]

const PRIORITIES: { value: FeedbackPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-text-muted' },
  { value: 'medium', label: 'Medium', color: 'bg-status-warning' },
  { value: 'high', label: 'High', color: 'bg-status-danger' },
  { value: 'critical', label: 'Critical', color: 'bg-red-600' },
]

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState<FeedbackCategory | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<FeedbackPriority>('medium')
  const [submitting, setSubmitting] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  const reset = () => {
    setCategory(null)
    setTitle('')
    setDescription('')
    setPriority('medium')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || !title.trim() || !description.trim()) return

    setSubmitting(true)
    try {
      await feedbackApi.create({
        category,
        title: title.trim(),
        description: description.trim(),
        priority,
        page_url: window.location.href,
      })
      toast.success('Feedback submitted! Thank you.')
      reset()
      setIsOpen(false)
    } catch {
      toast.error('Failed to submit feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover transition-all hover:scale-105 active:scale-95"
        aria-label="Send feedback"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquarePlus className="w-5 h-5" />}
        <span className="text-sm font-medium hidden sm:inline">Feedback</span>
      </button>

      {/* Feedback panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-6 z-50 w-[380px] max-h-[calc(100vh-120px)] bg-surface border border-border-primary rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border-subtle bg-surface-secondary">
            <h3 className="text-base font-semibold text-text-primary">Send Feedback</h3>
            <p className="text-xs text-text-muted mt-0.5">Help us improve SidMonitor</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
            <div className="p-5 space-y-4">
              {/* Category selection */}
              {!category ? (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">What would you like to share?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className="flex items-center gap-2 p-3 rounded-lg border border-border-primary hover:border-accent hover:bg-accent/5 transition-colors text-left"
                      >
                        <span className={cat.color}>{cat.icon}</span>
                        <span className="text-sm font-medium text-text-primary">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Selected category badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={CATEGORIES.find(c => c.value === category)?.color}>
                        {CATEGORIES.find(c => c.value === category)?.icon}
                      </span>
                      <span className="text-sm font-medium text-text-primary">
                        {CATEGORIES.find(c => c.value === category)?.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCategory(null)}
                      className="text-xs text-accent hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  {/* Title */}
                  <div>
                    <label htmlFor="fb-title" className="block text-sm font-medium text-text-secondary mb-1">Title</label>
                    <input
                      id="fb-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Brief summary..."
                      maxLength={255}
                      required
                      className="w-full px-3 py-2 text-sm border border-border-primary rounded-lg bg-surface text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="fb-desc" className="block text-sm font-medium text-text-secondary mb-1">Description</label>
                    <textarea
                      id="fb-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={category === 'bug' ? 'Steps to reproduce, expected vs actual behavior...' : 'Describe your idea or question in detail...'}
                      rows={4}
                      maxLength={5000}
                      required
                      className="w-full px-3 py-2 text-sm border border-border-primary rounded-lg bg-surface text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                    />
                    <div className="text-right text-xs text-text-muted mt-1">{description.length}/5000</div>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Priority</label>
                    <div className="flex gap-2">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setPriority(p.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                            priority === p.value
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border-primary text-text-secondary hover:border-accent/50'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${p.color}`} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Submit button */}
            {category && (
              <div className="px-5 py-3 border-t border-border-subtle bg-surface-secondary">
                <button
                  type="submit"
                  disabled={submitting || !title.trim() || !description.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  )
}
