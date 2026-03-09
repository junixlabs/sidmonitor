/**
 * Frontend Error Logger
 * Logs errors to console and sends to backend for file logging
 */

interface ErrorLog {
  timestamp: string
  type: 'error' | 'warning' | 'navigation' | 'api' | 'render'
  message: string
  stack?: string
  url?: string
  component?: string
  metadata?: Record<string, unknown>
}

class ErrorLogger {
  private logs: ErrorLog[] = []
  private isEnabled = true

  constructor() {
    this.setupGlobalHandlers()
  }

  private setupGlobalHandlers() {
    // Catch unhandled errors
    window.onerror = (message, source, lineno, colno, error) => {
      this.log({
        type: 'error',
        message: String(message),
        stack: error?.stack,
        url: source,
        metadata: { lineno, colno }
      })
      return false
    }

    // Catch unhandled promise rejections
    window.onunhandledrejection = (event) => {
      this.log({
        type: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
      })
    }

    // Intercept console.error
    const originalError = console.error
    console.error = (...args) => {
      this.log({
        type: 'error',
        message: args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '),
      })
      originalError.apply(console, args)
    }
  }

  log(entry: Omit<ErrorLog, 'timestamp'>) {
    if (!this.isEnabled) return

    const log: ErrorLog = {
      ...entry,
      timestamp: new Date().toISOString(),
    }

    this.logs.push(log)

    // Log to console with styling
    const style = this.getLogStyle(entry.type)
    console.log(
      `%c[${entry.type.toUpperCase()}] ${log.timestamp}`,
      style,
      log.message,
      log.metadata || ''
    )

    // Send to backend for file logging (debounced)
    this.sendToBackend(log)
  }

  private getLogStyle(type: ErrorLog['type']): string {
    const styles: Record<ErrorLog['type'], string> = {
      error: 'color: #ff4444; font-weight: bold',
      warning: 'color: #ffaa00; font-weight: bold',
      navigation: 'color: #4488ff; font-weight: bold',
      api: 'color: #44ff88; font-weight: bold',
      render: 'color: #ff44ff; font-weight: bold',
    }
    return styles[type]
  }

  private async sendToBackend(log: ErrorLog) {
    try {
      // Send to backend endpoint for file logging
      await fetch('/api/v1/frontend-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      }).catch(() => {
        // Silently fail - don't create infinite loop
      })
    } catch {
      // Ignore errors when sending logs
    }
  }

  // Log navigation events
  logNavigation(from: string, to: string, success: boolean) {
    this.log({
      type: 'navigation',
      message: success
        ? `Navigation: ${from} -> ${to}`
        : `Navigation FAILED: ${from} -> ${to}`,
      metadata: { from, to, success }
    })
  }

  // Log API errors
  logApiError(endpoint: string, status: number, message: string) {
    this.log({
      type: 'api',
      message: `API Error [${status}]: ${endpoint} - ${message}`,
      metadata: { endpoint, status }
    })
  }

  // Log render errors
  logRenderError(component: string, error: Error) {
    this.log({
      type: 'render',
      message: `Render Error in ${component}: ${error.message}`,
      stack: error.stack,
      component,
    })
  }

  // Get all logs
  getLogs(): ErrorLog[] {
    return [...this.logs]
  }

  // Export logs to file (for debugging)
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  // Clear logs
  clear() {
    this.logs = []
  }

  // Enable/disable logging
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger()

// React Error Boundary helper
export function logComponentError(error: Error, componentStack: string) {
  errorLogger.log({
    type: 'render',
    message: error.message,
    stack: error.stack,
    metadata: { componentStack }
  })
}

export default errorLogger
