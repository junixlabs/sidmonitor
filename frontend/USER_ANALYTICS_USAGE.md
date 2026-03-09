# User Analytics Component - Usage Guide

## Overview

The `UserAnalytics` component provides a comprehensive view of user activity and error patterns in the monitoring dashboard.

## Features

1. **Top Users Table**: Displays active users with sortable columns for:
   - Total Requests
   - Error Count
   - Error Rate
   - Average Response Time

2. **Users with High Error Rates**: Highlights users experiencing above-average errors

## Installation

The component is already integrated into the codebase at:
- Component: `/frontend/src/components/dashboard/UserAnalytics.tsx`
- Types: `/frontend/src/types/index.ts`
- API Client: `/frontend/src/api/client.ts`
- Hooks: `/frontend/src/hooks/useLogs.ts`

## Usage Example

### Basic Usage

```tsx
import { UserAnalytics } from '../components/dashboard'

function UserAnalyticsPage() {
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        User Analytics
      </h1>
      <UserAnalytics />
    </div>
  )
}
```

### Integration with Dashboard

```tsx
import { UserAnalytics } from '../components/dashboard'

function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Other dashboard components */}

      <div className="mt-8">
        <UserAnalytics />
      </div>
    </div>
  )
}
```

## API Endpoints

The component uses these backend endpoints:

1. **GET /stats/top-users**
   - Returns: `UserStats[]`
   - Params: `limit` (optional), `project_id` (optional)

2. **GET /stats/users-with-errors**
   - Returns: `UserWithErrors[]`
   - Params: `limit` (optional), `project_id` (optional)

3. **GET /stats/user-activity**
   - Returns: `UserActivityPoint[]`
   - Params: `user_id` (required), `start_date`, `end_date`, `interval`, `project_id`

## TypeScript Types

### UserStats
```typescript
interface UserStats {
  user_id: string
  user_name?: string
  total_requests: number
  error_count: number
  error_rate: number
  avg_response_time: number
}
```

### UserWithErrors
```typescript
interface UserWithErrors {
  user_id: string
  user_name?: string
  total_requests: number
  error_count: number
  error_rate: number
}
```

### UserActivityPoint
```typescript
interface UserActivityPoint {
  timestamp: string
  requests: number
  errors: number
}
```

## Custom Hooks

### useTopUsers
Fetches top users by activity:
```typescript
const { data, isLoading } = useTopUsers(10) // limit = 10
```

### useUsersWithErrors
Fetches users with high error rates:
```typescript
const { data, isLoading } = useUsersWithErrors(5) // limit = 5
```

### useUserActivity
Fetches activity timeline for a specific user:
```typescript
const { data, isLoading } = useUserActivity('user-123', {
  start_date: '2024-01-01T00:00:00Z',
  end_date: '2024-01-31T23:59:59Z',
  interval: 'hour'
})
```

## Features

### Sortable Columns
Click on column headers to sort by:
- Total Requests
- Error Count
- Error Rate
- Average Response Time

### Color-Coded Error Rates
- Green: < 5% error rate
- Yellow: 5-20% error rate
- Red: > 20% error rate

### Auto-Refresh
Data automatically refreshes every 60 seconds

## Styling

The component uses TailwindCSS and follows the existing dashboard design patterns:
- White cards with shadows
- Responsive grid layouts
- Loading skeletons
- Hover states for interactive elements

## Notes

- The component automatically uses the current project from the AuthContext
- Data is cached and refreshed based on the query configuration
- Empty states are handled gracefully with informative messages
