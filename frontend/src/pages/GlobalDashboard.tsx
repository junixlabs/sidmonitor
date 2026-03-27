import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Folder, BarChart3, AlertTriangle, Search, ChevronRight, Plus } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { formatNumber, formatResponseTime } from '@/utils/format'
import { ErrorAlert } from '@/components/ui'
import { useGlobalStats } from '@/hooks/useLogs'
import { orgApi, projectApi } from '@/api/client'

type TimeRange = '24h' | '7d' | '30d'

export default function GlobalDashboard() {
  const navigate = useNavigate()
  const projects = useWorkspaceStore((s) => s.projects)
  const setProjects = useWorkspaceStore((s) => s.setProjects)
  const setOrganizations = useWorkspaceStore((s) => s.setOrganizations)
  const setCurrentOrg = useWorkspaceStore((s) => s.setCurrentOrg)
  const organizations = useWorkspaceStore((s) => s.organizations)
  const [searchQuery, setSearchQuery] = useState('')
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const { data: stats, isLoading: loading, error: queryError } = useGlobalStats(timeRange)

  const currentOrg = useWorkspaceStore((s) => s.currentOrg)

  // Ensure projects are loaded when the global dashboard mounts
  useEffect(() => {
    async function loadProjects() {
      try {
        let orgs = organizations
        if (orgs.length === 0) {
          orgs = await orgApi.list()
          setOrganizations(orgs)
          if (!currentOrg && orgs.length > 0) {
            setCurrentOrg(orgs[0])
          }
        }
        const org = currentOrg || orgs[0]
        if (org && projects.length === 0) {
          const loaded = await projectApi.list(org.slug)
          setProjects(loaded)
        }
      } catch {
        // ignore — Layout will also attempt this
      }
    }
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleProjectClick = (projectId: string) => {
    const existingProject = projects.find(p => p.id === projectId)
    if (existingProject && currentOrg) {
      navigate(`/${currentOrg.slug}/${existingProject.slug}/dashboard`)
    } else {
      navigate('/organizations')
    }
  }

  const formatProjectName = (projectName: string, projectId: string) => {
    // If project name is the same as project_id, show formatted version
    if (projectName === projectId) {
      return `Project ${projectId.substring(0, 8)}`
    }
    return projectName
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-status-success/10 text-status-success'
      case 'warning':
        return 'bg-status-warning/10 text-status-warning'
      case 'critical':
        return 'bg-status-danger/10 text-status-danger'
      default:
        return 'bg-surface-tertiary text-text-secondary'
    }
  }

  const getHealthDot = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-status-success'
      case 'warning':
        return 'bg-status-warning'
      case 'critical':
        return 'bg-status-danger'
      default:
        return 'bg-text-muted'
    }
  }

  const filteredProjects = useMemo(() =>
    stats?.projects.filter(project =>
      project.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_id.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []
  , [stats, searchQuery])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-text-muted">Loading global dashboard...</div>
      </div>
    )
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Global Dashboard</h1>
            <p className="mt-1 text-sm text-text-muted">
              Overview of all projects across all organizations
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Time Range Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-text-muted">Time range:</span>
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  onClick={() => setTimeRange('24h')}
                  className={`px-4 py-2 text-sm font-medium border ${
                    timeRange === '24h'
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface text-text-secondary border-border-primary hover:bg-surface-secondary'
                  } rounded-l-md`}
                >
                  24h
                </button>
                <button
                  onClick={() => setTimeRange('7d')}
                  className={`px-4 py-2 text-sm font-medium border-t border-b ${
                    timeRange === '7d'
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface text-text-secondary border-border-primary hover:bg-surface-secondary'
                  }`}
                >
                  7d
                </button>
                <button
                  onClick={() => setTimeRange('30d')}
                  className={`px-4 py-2 text-sm font-medium border ${
                    timeRange === '30d'
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface text-text-secondary border-border-primary hover:bg-surface-secondary'
                  } rounded-r-md`}
                >
                  30d
                </button>
              </div>
            </div>
          </div>
        </div>

        {queryError && (
          <ErrorAlert
            message="Failed to load global dashboard stats"
            description="Please check your connection."
            className="mb-4"
          />
        )}

        {stats && stats.total_projects === 0 && (
          <div className="bg-surface shadow rounded-lg p-12 text-center">
            <Folder className="h-12 w-12 text-text-muted mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-text-primary mb-2">No projects yet</h2>
            <p className="text-text-muted mb-6">
              Create your first project and install the SDK to start monitoring.
            </p>
            <button
              onClick={() => navigate(currentOrg ? `/${currentOrg.slug}/projects/new` : '/organizations')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-accent hover:bg-accent-hover"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </button>
          </div>
        )}

        {stats && stats.total_projects > 0 && (
          <>
            {/* Aggregated Stats Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
              <div className="bg-surface overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="rounded-md bg-accent p-3">
                        <Folder className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-text-muted truncate">Total Projects</dt>
                        <dd className="text-3xl font-semibold text-text-primary">{stats.total_projects}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="rounded-md bg-status-success p-3">
                        <BarChart3 className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-text-muted truncate">Total Requests (24h)</dt>
                        <dd className="text-3xl font-semibold text-text-primary">{formatNumber(stats.total_requests)}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={`rounded-md p-3 ${
                        stats.overall_error_rate > 20 ? 'bg-status-danger' :
                        stats.overall_error_rate > 5 ? 'bg-status-warning' :
                        'bg-status-success'
                      }`}>
                        <AlertTriangle className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-text-muted truncate">Overall Error Rate</dt>
                        <dd className="text-3xl font-semibold text-text-primary">{stats.overall_error_rate.toFixed(2)}%</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Most Active Projects */}
            {stats.most_active_projects.length > 0 && (
              <div className="mb-8 bg-surface shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-text-primary mb-4">Most Active Projects</h2>
                <div className="space-y-3">
                  {stats.most_active_projects.map((project) => (
                    <div
                      key={project.project_id}
                      onClick={() => handleProjectClick(project.project_id)}
                      className="flex items-center justify-between py-3 border-b border-border-subtle last:border-0 cursor-pointer hover:bg-surface-secondary rounded px-3 -mx-3"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`h-3 w-3 rounded-full ${getHealthDot(project.health_status)}`} />
                        <div>
                          <div className="text-sm font-medium text-text-primary">
                            {formatProjectName(project.project_name, project.project_id)}
                          </div>
                          <div className="text-xs text-text-muted font-mono">{project.project_id}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6 text-sm">
                        <div>
                          <span className="text-text-muted">Requests: </span>
                          <span className="font-medium text-text-primary">{formatNumber(project.total_requests)}</span>
                        </div>
                        <div>
                          <span className="text-text-muted">Error Rate: </span>
                          <span className={`font-medium ${
                            project.error_rate > 20 ? 'text-status-danger' :
                            project.error_rate > 5 ? 'text-status-warning' :
                            'text-status-success'
                          }`}>
                            {project.error_rate.toFixed(2)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted">Avg Time: </span>
                          <span className="font-medium text-text-primary">{formatResponseTime(project.avg_response_time)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Projects Table */}
            <div className="bg-surface shadow rounded-lg overflow-hidden">
              <div className="p-6 border-b border-border-subtle">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-text-primary">All Projects</h2>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64 px-4 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-accent focus:border-accent text-sm"
                    />
                    <Search className="absolute right-3 top-2.5 h-5 w-5 text-text-muted" />
                  </div>
                </div>
              </div>

              {filteredProjects.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border-subtle">
                    <thead className="bg-surface-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                          Total Requests
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                          Error Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                          Avg Response Time
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-border-subtle">
                      {filteredProjects.map((project) => (
                        <tr
                          key={project.project_id}
                          onClick={() => handleProjectClick(project.project_id)}
                          className="hover:bg-surface-secondary cursor-pointer"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-text-primary">
                                {formatProjectName(project.project_name, project.project_id)}
                              </div>
                              <div className="text-xs text-text-muted font-mono">{project.project_id}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getHealthColor(project.health_status)}`}>
                              <span className={`mr-1.5 h-2 w-2 rounded-full ${getHealthDot(project.health_status)}`} />
                              {project.health_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                            {formatNumber(project.total_requests)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              project.error_rate > 20 ? 'text-status-danger' :
                              project.error_rate > 5 ? 'text-status-warning' :
                              'text-status-success'
                            }`}>
                              {project.error_rate.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                            {formatResponseTime(project.avg_response_time)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleProjectClick(project.project_id)
                              }}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-accent bg-accent/10 hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
                            >
                              <ChevronRight className="w-4 h-4 mr-1" />
                              View Dashboard
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-text-muted">
                  {searchQuery ? 'No projects found matching your search' : 'No projects available'}
                </div>
              )}
            </div>
          </>
        )}
    </div>
  )
}
