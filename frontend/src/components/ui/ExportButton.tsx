import { useState, useEffect, useRef, useCallback } from 'react'

import { Download, ChevronDown, FileText, FileCode } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ExportButtonProps {
  disabled?: boolean
  onExportCSV: () => void
  onExportJSON: () => void
  className?: string
}

export function ExportButton({ disabled, onExportCSV, onExportJSON, className }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const handleCSV = useCallback(() => {
    onExportCSV()
    setShowMenu(false)
  }, [onExportCSV])

  const handleJSON = useCallback(() => {
    onExportJSON()
    setShowMenu(false)
  }, [onExportJSON])

  return (
    <div className={cn('relative', className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md border border-border-primary bg-surface px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4 text-text-muted" />
        Export
        <ChevronDown className="h-4 w-4 text-text-muted" />
      </button>

      {showMenu && (
        <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-surface shadow-lg ring-1 ring-border-primary">
          <div className="py-1" role="menu">
            <button
              type="button"
              onClick={handleCSV}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-surface-secondary"
              role="menuitem"
            >
              <FileText className="h-4 w-4 text-text-muted" />
              Export as CSV
            </button>
            <button
              type="button"
              onClick={handleJSON}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-surface-secondary"
              role="menuitem"
            >
              <FileCode className="h-4 w-4 text-text-muted" />
              Export as JSON
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
