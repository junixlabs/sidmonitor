# Integration Guide: Adding PerformanceMetrics to Dashboard

This guide shows how to integrate the PerformanceMetrics component into your existing Dashboard page.

## Quick Start

### Option 1: Add to Existing Dashboard.tsx

Add the following code to your Dashboard component (e.g., `/frontend/src/pages/Dashboard.tsx`):

```tsx
// 1. Import the hooks at the top of the file
import {
  useStats,
  useTopEndpoints,
  // ... other imports
  usePerformancePercentiles,
  useSlowRequests,
  usePerformanceTimeline,
} from '../hooks/useLogs'

// 2. Import the component
import PerformanceMetrics from '../components/dashboard/PerformanceMetrics'

// 3. Inside your Dashboard component, add the hooks after existing hooks:
export default function Dashboard() {
  // ... existing hooks ...

  // Add these hooks
  const { data: percentiles, isLoading: percentilesLoading } = usePerformancePercentiles(activeTab)
  const { data: slowRequests, isLoading: slowRequestsLoading } = useSlowRequests(activeTab)
  const { data: performanceTimeline, isLoading: perfTimelineLoading } = usePerformanceTimeline(
    { start_date: startDate },
    activeTab
  )

  const perfLoading = percentilesLoading || slowRequestsLoading || perfTimelineLoading

  // ... rest of component ...

  // 4. Add the component to your JSX (e.g., after the Request Statistics section):
  return (
    <div className="px-4 py-6 sm:px-0">
      {/* ... existing dashboard content ... */}

      {/* Add this section */}
      <div className="mt-8">
        <PerformanceMetrics
          percentiles={percentiles}
          slowRequests={slowRequests}
          timeline={performanceTimeline}
          loading={perfLoading}
        />
      </div>
    </div>
  )
}
```

### Option 2: Use the Example Component

If you want a self-contained component with all the logic built-in:

```tsx
import PerformanceMetricsExample from '../components/dashboard/PerformanceMetricsExample'

export default function Dashboard() {
  const activeTab: DashboardTab = 'all' // or get from state
  const timeRange = '24h' // or get from state

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* ... existing content ... */}

      <div className="mt-8">
        <PerformanceMetricsExample
          activeTab={activeTab}
          timeRange={timeRange}
        />
      </div>
    </div>
  )
}
```

### Option 3: Create a Separate Performance Page

Create a new route for performance metrics:

```tsx
// src/pages/Performance.tsx
import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import PerformanceMetrics from '../components/dashboard/PerformanceMetrics'
import DashboardTabs from '../components/dashboard/DashboardTabs'
import {
  usePerformancePercentiles,
  useSlowRequests,
  usePerformanceTimeline,
  useTabCounts,
} from '../hooks/useLogs'
import type { DashboardTab } from '../types'

type TimeRange = '1h' | '6h' | '24h' | '7d'

export default function Performance() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as DashboardTab) || 'all'
  const timeRange = (searchParams.get('range') as TimeRange) || '24h'

  const startDate = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    switch (timeRange) {
      case '1h': start.setHours(now.getHours() - 1); break
      case '6h': start.setHours(now.getHours() - 6); break
      case '24h': start.setHours(now.getHours() - 24); break
      case '7d': start.setDate(now.getDate() - 7); break
    }
    return start.toISOString()
  }, [timeRange])

  const { data: percentiles, isLoading: percentilesLoading } = usePerformancePercentiles(activeTab)
  const { data: slowRequests, isLoading: slowRequestsLoading } = useSlowRequests(activeTab)
  const { data: timeline, isLoading: timelineLoading } = usePerformanceTimeline(
    { start_date: startDate },
    activeTab
  )
  const { data: tabCounts, isLoading: tabCountsLoading } = useTabCounts()

  const isLoading = percentilesLoading || slowRequestsLoading || timelineLoading

  const handleTabChange = (tab: DashboardTab) => {
    if (tab === 'all') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', tab)
    }
    setSearchParams(searchParams)
  }

  const handleTimeRangeChange = (range: TimeRange) => {
    if (range === '24h') {
      searchParams.delete('range')
    } else {
      searchParams.set('range', range)
    }
    setSearchParams(searchParams)
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Performance Metrics</h1>

      <DashboardTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={tabCounts}
        loading={tabCountsLoading}
      />

      <div className="mb-6 flex justify-end">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {(['1h', '6h', '24h', '7d'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <PerformanceMetrics
        percentiles={percentiles}
        slowRequests={slowRequests}
        timeline={timeline}
        loading={isLoading}
      />
    </div>
  )
}
```

Then add the route to your router configuration:

```tsx
// In your router setup (e.g., App.tsx or routes.tsx)
import Performance from './pages/Performance'

// Add to routes
<Route path="/performance" element={<Performance />} />
```

## API Requirements

Make sure your backend implements these endpoints:

- `GET /api/stats/percentiles?project_id=<id>&type=<all|inbound|outbound>`
- `GET /api/stats/slow-requests?project_id=<id>&type=<all|inbound|outbound>`
- `GET /api/stats/performance-timeline?project_id=<id>&type=<all|inbound|outbound>&start_date=<iso-date>`

## Customization

### Change Time Ranges

Modify the time range calculations in `startDate` computation.

### Change Percentile Colors

Edit the `PercentileCard` color props in `PerformanceMetrics.tsx`:

```tsx
<PercentileCard label="p50" value={percentiles?.p50 || 0} color="bg-green-500" />
```

### Change Slow Request Thresholds

Edit the color logic in the slow requests summary section:

```tsx
slowRequests.slow_percentage < 5 ? 'text-green-600' :
slowRequests.slow_percentage < 10 ? 'text-yellow-600' :
'text-red-600'
```

### Customize Chart Colors

Edit the Line components in the ResponsiveContainer:

```tsx
<Line dataKey="p50" name="P50 (Median)" stroke="#10b981" />
```

## Troubleshooting

### Data not loading

1. Check browser console for API errors
2. Verify backend endpoints are accessible
3. Check that project ID is being passed correctly
4. Verify authentication token is valid

### Component not rendering

1. Ensure all imports are correct
2. Check that types are exported from `types/index.ts`
3. Verify React Query provider is set up in your app

### TypeScript errors

1. Run `npm run build` to see detailed errors
2. Make sure `recharts` and `date-fns` are installed
3. Check that all type exports are correct

## Next Steps

- Add export functionality for performance data
- Add filters for specific endpoints or modules
- Add alerting thresholds for performance degradation
- Add comparison views (current vs. previous period)
