/**
 * Format large numbers into human-readable format
 * Examples: 1234567 -> "1.2M", 45678 -> "45.7K", 123 -> "123"
 */
export function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '-'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

/**
 * Format percentages with 2 decimal places
 */
export function formatPercentage(num: number | undefined): string {
  if (num === undefined || num === null) return '-'
  return `${num.toFixed(2)}%`
}

/**
 * Format response times (milliseconds to human-readable)
 * Examples: 150 -> "150ms", 2500 -> "2.50s"
 */
export function formatResponseTime(ms: number | undefined): string {
  if (ms === undefined || ms === null) return '-'
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms.toFixed(0)}ms`
}

/**
 * Format durations (milliseconds to human-readable)
 * Same as formatResponseTime, but semantically distinct
 */
export function formatDuration(ms: number | undefined): string {
  return formatResponseTime(ms)
}

/**
 * Format count for display (with locale separators for smaller numbers)
 */
export function formatCount(num: number | undefined): string {
  if (num === undefined || num === null) return '0'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

/**
 * Format latency (alias for formatResponseTime, used in outbound context)
 */
export function formatLatency(ms: number | undefined): string {
  return formatResponseTime(ms)
}

/**
 * Format bytes to human-readable
 * Examples: 1024 -> "1.0KB", 1048576 -> "1.00MB"
 */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) return '-'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
