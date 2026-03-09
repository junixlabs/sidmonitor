import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'

interface StatusBarProps {
  sidebarCollapsed: boolean
}

interface SystemStatus {
  critical: number
  warnings: number
  lastUpdated: Date
}

export default function StatusBar({ sidebarCollapsed }: StatusBarProps) {
  const [status, setStatus] = useState<SystemStatus>({
    critical: 1,
    warnings: 3,
    lastUpdated: new Date(),
  })
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('just now')

  // Update time display
  useEffect(() => {
    const updateTimeDisplay = () => {
      const now = new Date()
      const diff = Math.floor((now.getTime() - status.lastUpdated.getTime()) / 1000)

      if (diff < 5) {
        setTimeSinceUpdate('just now')
      } else if (diff < 60) {
        setTimeSinceUpdate(`${diff}s ago`)
      } else if (diff < 3600) {
        setTimeSinceUpdate(`${Math.floor(diff / 60)}m ago`)
      } else {
        setTimeSinceUpdate(`${Math.floor(diff / 3600)}h ago`)
      }
    }

    updateTimeDisplay()
    const interval = setInterval(updateTimeDisplay, 1000)
    return () => clearInterval(interval)
  }, [status.lastUpdated])

  // Simulate periodic updates - replace with real data later
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus((prev) => ({
        ...prev,
        lastUpdated: new Date(),
      }))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setStatus((prev) => ({
      ...prev,
      lastUpdated: new Date(),
    }))
  }

  return (
    <footer
      className={cn(
        'fixed bottom-0 right-0 h-8 z-30',
        'flex items-center justify-between px-4',
        'border-t text-xs transition-all duration-300'
      )}
      style={{
        left: sidebarCollapsed ? '64px' : '240px',
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        color: 'var(--text-muted)',
      }}
    >
      {/* Left section - Status indicators */}
      <div className="flex items-center gap-4">
        {/* Critical alerts */}
        {status.critical > 0 && (
          <button
            className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--status-error)',
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-medium">{status.critical} Critical</span>
          </button>
        )}

        {/* Warnings */}
        {status.warnings > 0 && (
          <button
            className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              color: 'var(--status-warning)',
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-medium">{status.warnings} Warnings</span>
          </button>
        )}

        {/* All clear indicator */}
        {status.critical === 0 && status.warnings === 0 && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--status-success)',
            }}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="font-medium">All Systems Operational</span>
          </div>
        )}
      </div>

      {/* Center section - Separator */}
      <div
        className="h-4 w-px mx-4"
        style={{ backgroundColor: 'var(--border-primary)' }}
      />

      {/* Right section - Last updated & version */}
      <div className="flex items-center gap-4">
        {/* Last updated with refresh */}
        <div className="flex items-center gap-2">
          <span>Last updated: {timeSinceUpdate}</span>
          <button
            onClick={handleRefresh}
            className="p-1 rounded transition-colors hover:bg-gray-500/10"
            title="Refresh data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Separator */}
        <div
          className="h-4 w-px"
          style={{ backgroundColor: 'var(--border-primary)' }}
        />

        {/* Version */}
        <span>SidMonitor v1.0.0</span>
      </div>
    </footer>
  )
}
