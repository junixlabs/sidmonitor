import { useState, useEffect, useRef, useCallback } from 'react'

interface ExportButtonProps {
  disabled?: boolean
  onExportCSV: () => void
  onExportJSON: () => void
}

export default function ExportButton({ disabled, onExportCSV, onExportJSON }: ExportButtonProps) {
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
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled}
        className="inline-flex items-center px-4 py-2 border border-border-primary shadow-sm text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="h-5 w-5 mr-2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export
        <svg className="ml-2 h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showMenu && (
        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-surface ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu">
            <button
              type="button"
              onClick={handleCSV}
              className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
              role="menuitem"
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export as CSV
              </div>
            </button>
            <button
              type="button"
              onClick={handleJSON}
              className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
              role="menuitem"
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Export as JSON
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
