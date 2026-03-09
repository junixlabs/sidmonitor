import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { EmptyState } from '@/components/ui'
import type { TimeSeriesPoint } from '../../types'

interface RequestsChartProps {
  data: TimeSeriesPoint[]
  loading?: boolean
}

export default function RequestsChart({ data, loading = false }: RequestsChartProps) {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 bg-surface-tertiary rounded w-32 mb-4" />
          <div className="h-48 bg-surface-tertiary rounded w-full" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState title="No data available" description="Try selecting a different time range." className="h-64" />
    )
  }

  // Determine format based on data points and time range
  const getTimeFormat = () => {
    if (data.length === 0) return 'HH:mm'

    const firstDate = parseISO(data[0].timestamp)
    const lastDate = parseISO(data[data.length - 1].timestamp)
    const diffHours = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60)

    if (diffHours <= 2) return 'HH:mm' // Minutes
    if (diffHours <= 48) return 'HH:mm' // Hours
    return 'MMM dd' // Days
  }

  const timeFormat = getTimeFormat()

  const formattedData = data.map((point) => ({
    ...point,
    time: format(parseISO(point.timestamp), timeFormat),
  }))

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="requests"
          name="Requests"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="errors"
          name="Errors"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
