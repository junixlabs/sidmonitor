# PerformanceMetrics Component Structure

## Visual Component Tree

```
PerformanceMetrics
│
├─── Response Time Percentiles Section
│    ├─── Title: "Response Time Percentiles"
│    ├─── Grid (4 columns)
│    │    ├─── PercentileCard (P50) - Green
│    │    ├─── PercentileCard (P90) - Blue
│    │    ├─── PercentileCard (P95) - Yellow
│    │    └─── PercentileCard (P99) - Red
│    └─── Additional Stats Grid (4 columns)
│         ├─── Min
│         ├─── Average
│         ├─── Max
│         └─── P75
│
├─── Performance Over Time Chart
│    ├─── Title: "Performance Over Time"
│    └─── ResponsiveContainer
│         └─── LineChart
│              ├─── Line: P50 (Green)
│              ├─── Line: Average (Indigo)
│              ├─── Line: P95 (Yellow)
│              └─── Line: P99 (Red)
│
└─── Slow Requests Summary Section
     ├─── Title: "Slow Requests Summary"
     ├─── Summary Stats Grid (3 columns)
     │    ├─── Total Requests
     │    ├─── Slow Requests Count
     │    └─── Slow Percentage
     └─── Slowest Endpoints List
          └─── For each endpoint:
               ├─── HTTP Method Badge
               ├─── Endpoint Path
               ├─── Average Response Time
               ├─── P95 Response Time
               └─── Request Count
```

## Data Flow

```
Backend APIs
     │
     ├─── GET /api/stats/percentiles
     │         │
     │         ↓
     │    logApi.getPerformancePercentiles()
     │         │
     │         ↓
     │    usePerformancePercentiles() hook
     │         │
     │         ↓
     │    PerformancePercentiles data
     │         │
     │         └─→ percentiles prop
     │
     ├─── GET /api/stats/slow-requests
     │         │
     │         ↓
     │    logApi.getSlowRequests()
     │         │
     │         ↓
     │    useSlowRequests() hook
     │         │
     │         ↓
     │    SlowRequestsSummary data
     │         │
     │         └─→ slowRequests prop
     │
     └─── GET /api/stats/performance-timeline
               │
               ↓
          logApi.getPerformanceTimeline()
               │
               ↓
          usePerformanceTimeline() hook
               │
               ↓
          PerformanceTimelinePoint[] data
               │
               └─→ timeline prop
                    │
                    ↓
               PerformanceMetrics Component
                    │
                    ├─→ Percentile Cards
                    ├─→ Timeline Chart
                    └─→ Slow Requests Table
```

## Component Props Interface

```typescript
interface PerformanceMetricsProps {
  percentiles?: PerformancePercentiles
  slowRequests?: SlowRequestsSummary
  timeline?: PerformanceTimelinePoint[]
  loading?: boolean
}
```

## Sub-components

### PercentileCard

```typescript
interface PercentileCardProps {
  label: string        // e.g., "p50", "p95"
  value: number        // Response time in milliseconds
  color: string        // Tailwind color class
  loading?: boolean    // Show skeleton loader
}
```

**Renders:**
- Label (e.g., "p50")
- Formatted value (e.g., "125ms" or "2.50s")
- Circular badge with percentile label
- Color-coded background

## Styling Reference

### Color Scheme

| Element | Color | Tailwind Class | Hex |
|---------|-------|----------------|-----|
| P50 Card | Green | `bg-green-500` | #10b981 |
| P90 Card | Blue | `bg-blue-500` | #3b82f6 |
| P95 Card | Yellow | `bg-yellow-500` | #eab308 |
| P99 Card | Red | `bg-red-500` | #ef4444 |
| Average Line | Indigo | `stroke="#6366f1"` | #6366f1 |

### Grid Layouts

**Percentile Cards (Main):**
```css
grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4
```

**Additional Stats:**
```css
grid-cols-2 sm:grid-cols-4 gap-4
```

**Slow Requests Summary:**
```css
grid-cols-1 sm:grid-cols-3 gap-4
```

## Responsive Breakpoints

- **Mobile (< 640px)**: 1 column for cards, stacked layout
- **Tablet (640px - 1024px)**: 2 columns for percentile cards
- **Desktop (≥ 1024px)**: 4 columns for full layout

## Loading States

### Percentile Cards
- Skeleton: Gray animated pulse
- Height: 32px (h-8)
- Width: 80px (w-20)

### Timeline Chart
- Skeleton container: Full width
- Height: 256px (h-64)
- Animated pulse effect

### Slow Requests
- List items: 3 skeleton rows
- Height per row: 48px (h-12)

## Empty States

### No Percentile Data
Component still renders with 0 values, formatted as "0ms"

### No Timeline Data
Message: "No performance data available for the selected time range"

### No Slow Requests
Message: "No slow request data available"

## Accessibility

- Semantic HTML structure
- Color is not the only indicator (text labels included)
- Keyboard navigation supported
- Screen reader friendly labels

## Chart Configuration

### X-Axis
- Data key: `time` (formatted timestamp)
- Font size: 12px
- Color: `#9ca3af` (gray-400)

### Y-Axis
- Label: "Response Time (ms)"
- Font size: 12px
- Color: `#9ca3af` (gray-400)

### Tooltip
- Background: White
- Border: 1px solid `#e5e7eb` (gray-200)
- Border radius: 6px
- Format: "{value} ms" with 2 decimal places

### Lines
- Type: `monotone` (smooth curves)
- Stroke width: 2px
- No dots by default
- Active dot radius: 4px

## Performance Optimizations

- **React Query Caching**:
  - Percentiles/Slow Requests: 30s refetch, 25s stale time
  - Timeline: 60s refetch, 55s stale time

- **Memoization**:
  - Timeline formatting uses `useMemo`
  - Time format calculation cached

- **Conditional Rendering**:
  - Loading states prevent data rendering
  - Empty states avoid unnecessary calculations

## Browser Support

Same as parent application (modern browsers):
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies Graph

```
PerformanceMetrics.tsx
├── recharts
│   ├── LineChart
│   ├── Line
│   ├── XAxis
│   ├── YAxis
│   ├── CartesianGrid
│   ├── Tooltip
│   ├── ResponsiveContainer
│   └── Legend
├── date-fns
│   ├── format
│   └── parseISO
└── utils/format
    └── formatResponseTime
```

## File Size

- **Component**: ~12 KB (minified ~8 KB)
- **Types**: Minimal overhead (shared)
- **Dependencies**: Already in bundle (recharts, date-fns)

## Testing Considerations

### Unit Tests
- Percentile card rendering
- Timeline chart data transformation
- Empty state handling
- Loading state display

### Integration Tests
- Data fetching with hooks
- Tab filter integration
- Time range changes

### Visual Regression
- Card layouts across breakpoints
- Chart rendering
- Color accuracy
