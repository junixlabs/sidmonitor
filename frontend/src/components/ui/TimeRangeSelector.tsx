import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export type PresetRange = '1h' | '6h' | '24h' | '7d' | '30d'

export interface DateRange {
  start: string // ISO string
  end: string   // ISO string
}

interface TimeRangeSelectorProps {
  presets?: PresetRange[]
  activePreset?: PresetRange | null
  onPresetChange?: (preset: PresetRange) => void
  customRange?: DateRange | null
  onCustomRangeChange?: (range: DateRange) => void
  className?: string
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function fromLocalDatetime(local: string): string {
  return new Date(local).toISOString()
}

export function TimeRangeSelector({
  presets = ['1h', '6h', '24h', '7d'],
  activePreset = '24h',
  onPresetChange,
  customRange,
  onCustomRangeChange,
  className,
}: TimeRangeSelectorProps) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const [startInput, setStartInput] = useState(
    customRange?.start
      ? toLocalDatetime(customRange.start)
      : toLocalDatetime(new Date(now.getTime() - 24 * 60 * 60_000).toISOString())
  )
  const [endInput, setEndInput] = useState(
    customRange?.end
      ? toLocalDatetime(customRange.end)
      : toLocalDatetime(now.toISOString())
  )

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showPicker])

  const handleApply = () => {
    onCustomRangeChange?.({
      start: fromLocalDatetime(startInput),
      end: fromLocalDatetime(endInput),
    })
    setShowPicker(false)
  }

  const isCustomActive = customRange !== null && customRange !== undefined && activePreset === null

  const customLabel = isCustomActive && customRange
    ? `${format(new Date(customRange.start), 'MMM d, HH:mm')} — ${format(new Date(customRange.end), 'MMM d, HH:mm')}`
    : null

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* Preset buttons */}
      <div className="flex bg-surface-tertiary/50 p-0.5 rounded-lg border border-border-subtle">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onPresetChange?.(preset)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              activePreset === preset && !isCustomActive
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Custom range trigger */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all',
            isCustomActive
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'bg-surface-tertiary/50 border-border-subtle text-text-secondary hover:text-text-primary'
          )}
        >
          <Calendar className="w-3.5 h-3.5" />
          {customLabel ? (
            <span className="max-w-[200px] truncate">{customLabel}</span>
          ) : (
            'Custom'
          )}
          <ChevronDown className={cn('w-3 h-3 transition-transform', showPicker && 'rotate-180')} />
        </button>

        {/* Dropdown picker */}
        {showPicker && (
          <div className="absolute right-0 top-full mt-2 z-50 bg-surface rounded-xl border border-border-primary shadow-lg p-4 w-[320px]">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Start</label>
                <input
                  type="datetime-local"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  max={endInput}
                  className="w-full px-3 py-2 text-sm bg-surface-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">End</label>
                <input
                  type="datetime-local"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  min={startInput}
                  max={toLocalDatetime(new Date().toISOString())}
                  className="w-full px-3 py-2 text-sm bg-surface-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Quick presets inside picker */}
              <div className="flex gap-1.5 pt-1">
                {[
                  { label: 'Last 3h', hours: 3 },
                  { label: 'Last 12h', hours: 12 },
                  { label: 'Last 48h', hours: 48 },
                  { label: 'Last 14d', hours: 14 * 24 },
                ].map(({ label, hours }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const end = new Date()
                      const start = new Date(end.getTime() - hours * 60 * 60_000)
                      setStartInput(toLocalDatetime(start.toISOString()))
                      setEndInput(toLocalDatetime(end.toISOString()))
                    }}
                    className="flex-1 px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary bg-surface-secondary hover:bg-surface-tertiary rounded-md transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowPicker(false)}
                  className="flex-1 px-3 py-2 text-xs font-medium text-text-secondary border border-border-primary rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-3 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
