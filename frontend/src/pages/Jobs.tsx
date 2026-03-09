import { useSearchParams } from 'react-router-dom'
import StatsCard from '../components/dashboard/StatsCard'
import JobsSummary from '../components/jobs/JobsSummary'
import JobsDetail from '../components/jobs/JobsDetail'
import { useJobStats } from '../hooks/useJobs'
import { formatNumber, formatPercentage, formatResponseTime } from '../utils/format'

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const jobClass = searchParams.get('job_class')

  const { data: stats, isLoading: statsLoading } = useJobStats('24h')

  const handleJobClick = (selectedJobClass: string) => {
    setSearchParams({ job_class: selectedJobClass })
  }

  const handleBackToSummary = () => {
    setSearchParams({})
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Job Monitoring</h1>

      {/* Stats Cards - Always visible */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Total Executions"
          value={formatNumber(stats?.total_executions)}
          color="indigo"
          loading={statsLoading}
        />
        <StatsCard
          title="Success Rate"
          value={formatPercentage(stats?.success_rate)}
          color="green"
          loading={statsLoading}
        />
        <StatsCard
          title="Avg Duration"
          value={formatResponseTime(stats?.avg_duration_ms)}
          color="blue"
          loading={statsLoading}
        />
        <StatsCard
          title="Failed Jobs"
          value={formatNumber(stats?.failure_count)}
          color="red"
          loading={statsLoading}
        />
      </div>

      {/* Conditional rendering based on view */}
      {jobClass ? (
        <JobsDetail jobClass={jobClass} onBack={handleBackToSummary} />
      ) : (
        <JobsSummary stats={stats} isLoading={statsLoading} onJobClick={handleJobClick} />
      )}
    </div>
  )
}
