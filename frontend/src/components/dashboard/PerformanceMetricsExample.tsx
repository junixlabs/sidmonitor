import { useMemo } from 'react'
import PerformanceMetrics from './PerformanceMetrics'
import { usePerformancePercentiles, useSlowRequests, usePerformanceTimeline } from '../../hooks/useLogs'
import type { DashboardTab } from '../../types'

interface PerformanceMetricsExampleProps {
  activeTab?: DashboardTab
  timeRange?: '1h' | '6h' | '24h' | '7d'
}

/**
 * Example component showing how to use the PerformanceMetrics component.
 * This component handles data fetching and can be used in the Dashboard or as a standalone page.
 */
export default function PerformanceMetricsExample({
  activeTab = 'all',
  timeRange = '24h',
}: PerformanceMetricsExampleProps) {
  // Calculate start_date based on time range
  const startDate = useMemo(() => {
    const now = new Date()
    const start = new Date(now)

    switch (timeRange) {
      case '1h':
        start.setHours(now.getHours() - 1)
        break
      case '6h':
        start.setHours(now.getHours() - 6)
        break
      case '24h':
        start.setHours(now.getHours() - 24)
        break
      case '7d':
        start.setDate(now.getDate() - 7)
        break
    }

    return start.toISOString()
  }, [timeRange])

  // Fetch performance data
  const { data: percentiles, isLoading: percentilesLoading } = usePerformancePercentiles(activeTab)
  const { data: slowRequests, isLoading: slowRequestsLoading } = useSlowRequests(activeTab)
  const { data: timeline, isLoading: timelineLoading } = usePerformanceTimeline(
    { start_date: startDate },
    activeTab
  )

  const isLoading = percentilesLoading || slowRequestsLoading || timelineLoading

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Performance Metrics</h1>
      <PerformanceMetrics
        percentiles={percentiles}
        slowRequests={slowRequests}
        timeline={timeline}
        loading={isLoading}
      />
    </div>
  )
}
