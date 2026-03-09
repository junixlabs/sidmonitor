/** Shared color/style helpers for HTTP status, methods, and health indicators. */

export function getStatusColor(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return 'bg-status-success/10 text-status-success'
  if (statusCode >= 400 && statusCode < 500) return 'bg-status-warning/10 text-status-warning'
  if (statusCode >= 500) return 'bg-status-danger/10 text-status-danger'
  return 'bg-surface-tertiary text-text-secondary'
}

export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'text-status-info',
    POST: 'text-status-success',
    PUT: 'text-status-warning',
    PATCH: 'text-status-warning',
    DELETE: 'text-status-danger',
    HEAD: 'text-accent',
    OPTIONS: 'text-text-secondary',
  }
  return colors[method] || 'text-text-secondary'
}

/** Method badge with background + text color (for tables) */
export function getMethodBadgeColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'bg-status-info/10 text-status-info',
    POST: 'bg-status-success/10 text-status-success',
    PUT: 'bg-status-warning/10 text-status-warning',
    PATCH: 'bg-status-warning/10 text-status-warning',
    DELETE: 'bg-status-danger/10 text-status-danger',
    HEAD: 'bg-accent/10 text-accent',
    OPTIONS: 'bg-surface-tertiary text-text-primary',
  }
  return colors[method] || 'bg-surface-tertiary text-text-primary'
}

export function getHealthColor(rate: number): { bg: string; text: string; dot: string } {
  if (rate >= 95) return { bg: 'bg-status-success/10', text: 'text-status-success', dot: 'bg-status-success' }
  if (rate >= 80) return { bg: 'bg-status-warning/10', text: 'text-status-warning', dot: 'bg-status-warning' }
  return { bg: 'bg-status-danger/10', text: 'text-status-danger', dot: 'bg-status-danger' }
}

/** Success rate badge class (for endpoint tables) */
export function getSuccessRateBadgeColor(rate: number): string {
  if (rate >= 99) return 'bg-status-success/10 text-status-success'
  if (rate >= 95) return 'bg-status-warning/10 text-status-warning'
  return 'bg-status-danger/10 text-status-danger'
}

/** Success rate text color */
export function getSuccessRateColor(rate: number): string {
  if (rate >= 99) return 'text-status-success'
  if (rate >= 95) return 'text-status-warning'
  return 'text-status-danger'
}

/** Health chart color (hex, for Recharts) */
export function getHealthChartColor(successRate: number): string {
  if (successRate >= 99) return '#10b981'
  if (successRate >= 95) return '#eab308'
  return '#ef4444'
}
