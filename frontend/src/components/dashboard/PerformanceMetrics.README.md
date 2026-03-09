# PerformanceMetrics Component

A comprehensive React component for displaying performance percentiles, slow requests, and performance timeline charts in the monitoring dashboard.

## Features

- **Response Time Percentiles**: Display P50, P90, P95, and P99 percentiles with color-coded cards
- **Additional Stats**: Show Min, Average, Max, and P75 response times
- **Performance Timeline**: Interactive line chart showing P50, Average, P95, and P99 over time
- **Slow Requests Summary**: Display total requests, slow count, percentage, and slowest endpoints
- **Loading States**: Built-in skeleton loaders for all sections
- **Responsive Design**: Works on mobile, tablet, and desktop screens

## Backend APIs

This component consumes the following backend endpoints:

- `GET /api/stats/percentiles` - Returns `PerformancePercentiles`
- `GET /api/stats/slow-requests` - Returns `SlowRequestsSummary`
- `GET /api/stats/performance-timeline` - Returns `PerformanceTimelinePoint[]`

## Usage

### Basic Usage

```tsx
import PerformanceMetrics from './components/dashboard/PerformanceMetrics'
import { usePerformancePercentiles, useSlowRequests, usePerformanceTimeline } from './hooks/useLogs'

function MyDashboard() {
  const { data: percentiles, isLoading: percentilesLoading } = usePerformancePercentiles()
  const { data: slowRequests, isLoading: slowRequestsLoading } = useSlowRequests()
  const { data: timeline, isLoading: timelineLoading } = usePerformanceTimeline({
    start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  })

  const isLoading = percentilesLoading || slowRequestsLoading || timelineLoading

  return (
    <PerformanceMetrics
      percentiles={percentiles}
      slowRequests={slowRequests}
      timeline={timeline}
      loading={isLoading}
    />
  )
}
```

### With Dashboard Tab Filter

```tsx
import PerformanceMetrics from './components/dashboard/PerformanceMetrics'
import { usePerformancePercentiles, useSlowRequests, usePerformanceTimeline } from './hooks/useLogs'
import type { DashboardTab } from './types'

function MyDashboard() {
  const activeTab: DashboardTab = 'inbound' // or 'outbound' or 'all'

  const { data: percentiles } = usePerformancePercentiles(activeTab)
  const { data: slowRequests } = useSlowRequests(activeTab)
  const { data: timeline } = usePerformanceTimeline(
    { start_date: startDate },
    activeTab
  )

  return (
    <PerformanceMetrics
      percentiles={percentiles}
      slowRequests={slowRequests}
      timeline={timeline}
    />
  )
}
```

### Using the Example Component

A complete example component is provided in `PerformanceMetricsExample.tsx`:

```tsx
import PerformanceMetricsExample from './components/dashboard/PerformanceMetricsExample'

function App() {
  return <PerformanceMetricsExample activeTab="all" timeRange="24h" />
}
```

## Component Props

### PerformanceMetrics

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `percentiles` | `PerformancePercentiles` | No | Percentile data (p50, p75, p90, p95, p99, min, max, avg) |
| `slowRequests` | `SlowRequestsSummary` | No | Slow requests summary with slowest endpoints |
| `timeline` | `PerformanceTimelinePoint[]` | No | Timeline data for the performance chart |
| `loading` | `boolean` | No | Loading state for skeleton loaders |

## TypeScript Types

### PerformancePercentiles

```typescript
interface PerformancePercentiles {
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
  max: number
  min: number
  avg: number
  total_requests: number
}
```

### SlowRequestsSummary

```typescript
interface SlowRequestsSummary {
  total_requests: number
  slow_count: number
  slow_percentage: number
  slowest_endpoints: SlowEndpoint[]
}

interface SlowEndpoint {
  endpoint: string
  method: string
  avg_response_time: number
  p95_response_time: number
  request_count: number
}
```

### PerformanceTimelinePoint

```typescript
interface PerformanceTimelinePoint {
  timestamp: string
  p50: number
  p95: number
  p99: number
  avg: number
}
```

## Custom Hooks

The following hooks are available in `hooks/useLogs.ts`:

### usePerformancePercentiles

```typescript
function usePerformancePercentiles(type?: DashboardTab): UseQueryResult<PerformancePercentiles>
```

Fetches performance percentiles data with automatic refetching every 30 seconds.

### useSlowRequests

```typescript
function useSlowRequests(type?: DashboardTab): UseQueryResult<SlowRequestsSummary>
```

Fetches slow requests summary with automatic refetching every 30 seconds.

### usePerformanceTimeline

```typescript
function usePerformanceTimeline(
  params?: TimeSeriesParams,
  type?: DashboardTab
): UseQueryResult<PerformanceTimelinePoint[]>
```

Fetches performance timeline data with automatic refetching every 60 seconds.

## Styling

The component uses TailwindCSS for styling and follows the existing design patterns from the Dashboard:

- **Color Coding**:
  - P50: Green (`bg-green-500`)
  - P90: Blue (`bg-blue-500`)
  - P95: Yellow (`bg-yellow-500`)
  - P99: Red (`bg-red-500`)

- **Slow Request Thresholds**:
  - < 5%: Green
  - 5-10%: Yellow
  - > 10%: Red

## Dependencies

- `recharts`: Line charts for performance timeline
- `date-fns`: Date formatting
- `@tanstack/react-query`: Data fetching and caching
- `clsx`: Conditional class names (if needed)

## Files

- `/frontend/src/components/dashboard/PerformanceMetrics.tsx` - Main component
- `/frontend/src/components/dashboard/PerformanceMetricsExample.tsx` - Usage example
- `/frontend/src/types/index.ts` - TypeScript type definitions
- `/frontend/src/api/client.ts` - API client functions
- `/frontend/src/hooks/useLogs.ts` - Custom React hooks
