import {
  AreaChart,
  Area,
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
        <div className="animate-pulse flex flex-col items-center w-full">
          <div className="h-4 bg-surface-tertiary rounded w-32 mb-4" />
          <div className="h-48 bg-surface-tertiary/50 rounded w-full" />
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

    if (diffHours <= 48) return 'HH:mm'
    return 'MMM dd'
  }

  const timeFormat = getTimeFormat()

  const formattedData = data.map((point) => ({
    ...point,
    time: format(parseISO(point.timestamp), timeFormat),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={formattedData}>
        <defs>
          <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="errorsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--status-error)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--status-error)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-subtle)"
          vertical={false}
        />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          stroke="var(--border-primary)"
          tickLine={false}
          axisLine={false}
          dy={8}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          stroke="var(--border-primary)"
          tickLine={false}
          axisLine={false}
          dx={-4}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '13px',
          }}
          labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
          itemStyle={{ color: 'var(--text-secondary)', padding: '2px 0' }}
          cursor={{ stroke: 'var(--border-primary)', strokeDasharray: '4 4' }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          type="monotone"
          dataKey="requests"
          name="Requests"
          stroke="var(--accent-primary)"
          strokeWidth={2}
          fill="url(#requestsGradient)"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--accent-primary)', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="errors"
          name="Errors"
          stroke="var(--status-error)"
          strokeWidth={2}
          fill="url(#errorsGradient)"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--status-error)', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
