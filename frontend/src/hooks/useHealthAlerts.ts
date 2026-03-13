import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { logApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useProjectId } from './useProjectId'
import { CACHE_CONFIG } from '@/utils/constants'

export interface HealthAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  detail: string
}

interface HealthAlertResult {
  alerts: HealthAlert[]
  critical: number
  warnings: number
  lastUpdated: Date
  isLoading: boolean
}

export function useHealthAlerts(): HealthAlertResult {
  const projectId = useProjectId()

  const { data: stats, dataUpdatedAt, isLoading } = useQuery({
    queryKey: queryKeys.stats.health(projectId!).queryKey,
    queryFn: () => logApi.getStats(projectId),
    ...CACHE_CONFIG.standard,
    enabled: !!projectId,
  })

  const alerts = useMemo<HealthAlert[]>(() => {
    if (!stats) return []

    const result: HealthAlert[] = []

    const errorCount = Math.round(stats.error_rate * stats.total_requests / 100)

    // Critical: error rate > 10%
    if (stats.error_rate > 10) {
      result.push({
        id: 'high-error-rate',
        severity: 'critical',
        message: `Error rate at ${stats.error_rate.toFixed(1)}%`,
        detail: `${errorCount} errors out of ${stats.total_requests} requests`,
      })
    }

    // Warning: error rate > 5%
    if (stats.error_rate > 5 && stats.error_rate <= 10) {
      result.push({
        id: 'elevated-error-rate',
        severity: 'warning',
        message: `Elevated error rate: ${stats.error_rate.toFixed(1)}%`,
        detail: `${errorCount} errors out of ${stats.total_requests} requests`,
      })
    }

    // Critical: avg response time > 5000ms
    if (stats.avg_response_time > 5000) {
      result.push({
        id: 'critical-response-time',
        severity: 'critical',
        message: `Avg response time: ${stats.avg_response_time.toFixed(0)}ms`,
        detail: 'Above 5000ms threshold',
      })
    }

    return result
  }, [stats])

  const critical = alerts.filter((a) => a.severity === 'critical').length
  const warnings = alerts.filter((a) => a.severity === 'warning').length

  return {
    alerts,
    critical,
    warnings,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : new Date(),
    isLoading,
  }
}
