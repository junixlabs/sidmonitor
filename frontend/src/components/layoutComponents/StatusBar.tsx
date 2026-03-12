import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/utils/constants'
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { useHealthAlerts } from '@/hooks/useHealthAlerts'
import { useQueryClient } from '@tanstack/react-query'

interface StatusBarProps {
  sidebarCollapsed: boolean
}

function formatTimeSince(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function StatusBar({ sidebarCollapsed }: StatusBarProps) {
  const { critical, warnings, lastUpdated, isLoading } = useHealthAlerts()
  const queryClient = useQueryClient()
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('just now')

  // Update time display every 10s — sub-10s granularity not useful to users
  useEffect(() => {
    setTimeSinceUpdate(formatTimeSince(lastUpdated))
    const interval = setInterval(() => {
      setTimeSinceUpdate(formatTimeSince(lastUpdated))
    }, 10_000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: ['inboundStats'] })
    queryClient.invalidateQueries({ queryKey: ['outboundStats'] })
    queryClient.invalidateQueries({ queryKey: ['jobStats'] })
  }, [queryClient])

  return (
    <footer
      className={cn(
        'fixed bottom-0 right-0 h-8 z-30',
        'flex items-center justify-between px-4',
        'border-t border-border-primary text-xs transition-all duration-300',
        'bg-surface text-text-muted'
      )}
      style={{ left: sidebarCollapsed ? '64px' : '240px' }}
    >
      {/* Left section - Status indicators */}
      <div className="flex items-center gap-4">
        {/* Critical alerts */}
        {critical > 0 && (
          <button className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors bg-status-danger/10 text-status-danger">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-medium">{critical} Critical</span>
          </button>
        )}

        {/* Warnings */}
        {warnings > 0 && (
          <button className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors bg-status-warning/10 text-status-warning">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-medium">{warnings} Warning{warnings !== 1 ? 's' : ''}</span>
          </button>
        )}

        {/* All clear indicator */}
        {critical === 0 && warnings === 0 && !isLoading && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-status-success/10 text-status-success">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="font-medium">All Systems Operational</span>
          </div>
        )}
      </div>

      {/* Center section - Separator */}
      <div className="h-4 w-px mx-4 bg-border-primary" />

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
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          </button>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-border-primary" />

        {/* Version */}
        <Link to="/whats-new" className="hover:underline">SidMonitor v{APP_VERSION}</Link>
      </div>
    </footer>
  )
}
