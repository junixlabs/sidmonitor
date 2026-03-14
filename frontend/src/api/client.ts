import axios, { AxiosError } from 'axios'
import { errorLogger } from '../utils/errorLogger'
import type {
  LogEntry,
  DashboardStats,
  FilterParams,
  PaginatedResponse,
  TimeSeriesPoint,
  TopEndpoint,
  ServiceHealth,
  ModuleHealth,
  TimeSeriesParams,
  User,
  UserUpdate,
  Organization,
  OrganizationMember,
  InviteMemberRequest,
  MemberRoleUpdate,
  Project,
  ProjectApiKey,
  AuthResponse,
  LoginCredentials,
  RegisterData,
  ApiKey,
  ApiKeyCreateResponse,
  DashboardTab,
  TabCounts,
  JobLog,
  JobStats,
  JobTimelinePoint,
  JobFilterParams,
  ScheduledTaskLog,
  ScheduledTaskStats,
  ScheduledTaskFilterParams,
  GlobalDashboardStats,
  TrafficByMethod,
  PeakHourStats,
  TrafficByDay,
  ThroughputStats,
  PerformancePercentiles,
  SlowRequestsSummary,
  PerformanceTimelinePoint,
  ErrorBreakdown,
  ErrorEndpoint,
  ErrorTimelinePoint,
  UserStats,
  UserActivityPoint,
  UserWithErrors,
  OutboundLog,
  OutboundLogDetail,
  OutboundLogFilterParams,
  OutboundStats,
  OutboundServiceHealth,
  OutboundHostHealth,
  OutboundEndpointStats,
  InboundLog,
  InboundLogDetail,
  InboundLogFilterParams,
  InboundStats,
  InboundModuleHealth,
  InboundEndpointStats,
  DsnResponse,
  AuditLogListResponse,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    // Fallback to legacy basic auth
    const auth = localStorage.getItem('auth')
    if (auth) {
      config.headers.Authorization = `Basic ${auth}`
    }
  }
  return config
})

// Response interceptor to handle auth errors and log API errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Log API error
    const endpoint = error.config?.url || 'unknown'
    const status = error.response?.status || 0
    const message = error.message || 'Unknown error'
    errorLogger.logApiError(endpoint, status, message)

    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('auth')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data)
    return response.data
  },

  getMe: async (): Promise<User> => {
    const response = await api.get('/auth/me')
    return response.data
  },

  updateMe: async (data: UserUpdate): Promise<User> => {
    const response = await api.patch('/auth/me', data)
    return response.data
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },
}

// Organization API
export const orgApi = {
  list: async (): Promise<Organization[]> => {
    const response = await api.get('/organizations')
    return response.data.organizations
  },

  get: async (slug: string): Promise<Organization> => {
    const response = await api.get(`/organizations/${slug}`)
    return response.data
  },

  create: async (name: string): Promise<Organization> => {
    const response = await api.post('/organizations', { name })
    return response.data
  },

  update: async (slug: string, data: { name?: string }): Promise<Organization> => {
    const response = await api.patch(`/organizations/${slug}`, data)
    return response.data
  },

  delete: async (slug: string): Promise<void> => {
    await api.delete(`/organizations/${slug}`)
  },

  // Member management
  listMembers: async (slug: string): Promise<OrganizationMember[]> => {
    const response = await api.get(`/organizations/${slug}/members`)
    return response.data
  },

  inviteMember: async (slug: string, data: InviteMemberRequest): Promise<OrganizationMember> => {
    const response = await api.post(`/organizations/${slug}/members`, data)
    return response.data
  },

  updateMember: async (slug: string, memberId: string, data: MemberRoleUpdate): Promise<OrganizationMember> => {
    const response = await api.patch(`/organizations/${slug}/members/${memberId}`, data)
    return response.data
  },

  removeMember: async (slug: string, memberId: string): Promise<void> => {
    await api.delete(`/organizations/${slug}/members/${memberId}`)
  },

  getAuditLogs: async (slug: string, page = 1, perPage = 50): Promise<AuditLogListResponse> => {
    const response = await api.get(`/organizations/${slug}/audit-log`, { params: { page, per_page: perPage } })
    return response.data
  },
}

// Project API
export const projectApi = {
  list: async (orgSlug: string): Promise<Project[]> => {
    const response = await api.get(`/organizations/${orgSlug}/projects`)
    return response.data.projects
  },

  get: async (projectSlug: string): Promise<Project> => {
    const response = await api.get(`/projects/${projectSlug}`)
    return response.data
  },

  create: async (orgSlug: string, data: { name: string; platform?: string; environment?: string }): Promise<Project> => {
    const response = await api.post(`/organizations/${orgSlug}/projects`, data)
    return response.data
  },

  update: async (projectSlug: string, data: { name?: string; environment?: string }): Promise<Project> => {
    const response = await api.patch(`/projects/${projectSlug}`, data)
    return response.data
  },

  delete: async (projectSlug: string): Promise<void> => {
    await api.delete(`/projects/${projectSlug}`)
  },

  // API Keys
  listApiKeys: async (projectSlug: string): Promise<ProjectApiKey[]> => {
    const response = await api.get(`/projects/${projectSlug}/api-keys`)
    return response.data.api_keys
  },

  createApiKey: async (projectSlug: string, data: { name: string; scopes?: string[] }): Promise<ProjectApiKey> => {
    const response = await api.post(`/projects/${projectSlug}/api-keys`, data)
    return response.data
  },

  revokeApiKey: async (projectSlug: string, keyId: string): Promise<void> => {
    await api.delete(`/projects/${projectSlug}/api-keys/${keyId}`)
  },

  getDsn: async (projectSlug: string): Promise<DsnResponse> => {
    const response = await api.get(`/projects/${projectSlug}/dsn`)
    return response.data
  },
}

// Logs API (with project context)
export const logApi = {
  getLogs: async (params: FilterParams & { project_id?: string }): Promise<PaginatedResponse<LogEntry>> => {
    const response = await api.get('/logs', { params })
    return response.data
  },

  getLog: async (id: string): Promise<LogEntry> => {
    const response = await api.get(`/logs/${id}`)
    return response.data
  },

  getStats: async (projectId?: string, type?: DashboardTab, startDate?: string, endDate?: string): Promise<DashboardStats> => {
    const response = await api.get('/stats', { params: { project_id: projectId, type, start_date: startDate, end_date: endDate } })
    return response.data
  },

  getModules: async (): Promise<string[]> => {
    const response = await api.get('/modules')
    return response.data
  },

  getEndpoints: async (): Promise<string[]> => {
    const response = await api.get('/endpoints')
    return response.data
  },

  getTimeSeries: async (params?: TimeSeriesParams & { project_id?: string }, type?: DashboardTab): Promise<TimeSeriesPoint[]> => {
    const response = await api.get('/stats/timeseries', { params: { ...params, type } })
    return response.data
  },

  getTopEndpoints: async (limit?: number, projectId?: string, type?: DashboardTab, startDate?: string, endDate?: string): Promise<TopEndpoint[]> => {
    const response = await api.get('/stats/top-endpoints', { params: { limit, project_id: projectId, type, start_date: startDate, end_date: endDate } })
    return response.data
  },

  getTabCounts: async (projectId?: string): Promise<TabCounts> => {
    const response = await api.get('/stats/counts', { params: { project_id: projectId } })
    return response.data
  },

  getServiceHealth: async (projectId?: string): Promise<ServiceHealth[]> => {
    const response = await api.get('/stats/service-health', { params: { project_id: projectId } })
    return response.data
  },

  getModuleHealth: async (projectId?: string, type?: DashboardTab): Promise<ModuleHealth[]> => {
    const response = await api.get('/stats/module-health', { params: { project_id: projectId, type } })
    return response.data
  },

  getGlobalStats: async (timeRange?: string): Promise<GlobalDashboardStats> => {
    const params: Record<string, string> = {}
    if (timeRange) {
      const now = new Date()
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720
      const start = new Date(now.getTime() - hours * 3600_000)
      params.start_date = start.toISOString()
      params.end_date = now.toISOString()
    }
    const response = await api.get('/stats/global', { params })
    return response.data
  },

  getTrafficByMethod: async (projectId?: string, type?: DashboardTab): Promise<TrafficByMethod[]> => {
    const response = await api.get('/stats/traffic-by-method', { params: { project_id: projectId, type } })
    return response.data
  },

  getPeakHours: async (projectId?: string, type?: DashboardTab): Promise<PeakHourStats[]> => {
    const response = await api.get('/stats/peak-hours', { params: { project_id: projectId, type } })
    return response.data
  },

  getTrafficByDay: async (projectId?: string, type?: DashboardTab): Promise<TrafficByDay[]> => {
    const response = await api.get('/stats/traffic-by-day', { params: { project_id: projectId, type } })
    return response.data
  },

  getThroughput: async (projectId?: string, type?: DashboardTab): Promise<ThroughputStats> => {
    const response = await api.get('/stats/throughput', { params: { project_id: projectId, type } })
    return response.data
  },

  getPerformancePercentiles: async (projectId?: string, type?: DashboardTab): Promise<PerformancePercentiles> => {
    const response = await api.get('/stats/percentiles', { params: { project_id: projectId, type } })
    return response.data
  },

  getSlowRequests: async (projectId?: string, type?: DashboardTab): Promise<SlowRequestsSummary> => {
    const response = await api.get('/stats/slow-requests', { params: { project_id: projectId, type } })
    return response.data
  },

  getPerformanceTimeline: async (params?: TimeSeriesParams & { project_id?: string }, type?: DashboardTab): Promise<PerformanceTimelinePoint[]> => {
    const response = await api.get('/stats/performance-timeline', { params: { ...params, type } })
    return response.data
  },

  // Error Analytics
  getErrorBreakdown: async (projectId?: string, type?: DashboardTab): Promise<ErrorBreakdown> => {
    const response = await api.get('/stats/error-breakdown', { params: { project_id: projectId, type } })
    return response.data
  },

  getErrorEndpoints: async (limit?: number, projectId?: string, type?: DashboardTab): Promise<ErrorEndpoint[]> => {
    const response = await api.get('/stats/error-endpoints', { params: { limit, project_id: projectId, type } })
    return response.data
  },

  getErrorTimeline: async (params?: TimeSeriesParams & { project_id?: string }, type?: DashboardTab): Promise<ErrorTimelinePoint[]> => {
    const response = await api.get('/stats/error-timeline', { params: { ...params, type } })
    return response.data
  },
}

// Job monitoring API
export const jobApi = {
  getJobs: async (params: JobFilterParams): Promise<PaginatedResponse<JobLog>> => {
    const response = await api.get('/v1/jobs', { params })
    return response.data
  },

  getJobStats: async (projectId: string, timeframe = '24h'): Promise<JobStats> => {
    const response = await api.get('/v1/jobs/stats', { params: { project_id: projectId, timeframe } })
    return response.data
  },

  getJobTimeline: async (projectId: string, timeframe = '24h', interval = 'hour'): Promise<JobTimelinePoint[]> => {
    const response = await api.get('/v1/jobs/timeline', { params: { project_id: projectId, timeframe, interval } })
    return response.data
  },

  getScheduledTasks: async (params: ScheduledTaskFilterParams): Promise<PaginatedResponse<ScheduledTaskLog>> => {
    const response = await api.get('/v1/scheduled-tasks', { params })
    return response.data
  },

  getScheduledTaskStats: async (projectId: string, timeframe = '7d'): Promise<ScheduledTaskStats> => {
    const response = await api.get('/v1/scheduled-tasks/stats', { params: { project_id: projectId, timeframe } })
    return response.data
  },
}

// Legacy settings API for backward compatibility
export const settingsApi = {
  getProjectSettings: async (): Promise<{
    project_name: string
    api_key_count: number
    api_key_preview?: string
    dsn_endpoint: string
  }> => {
    const response = await api.get('/settings/project')
    return response.data
  },

  getDSNInfo: async (): Promise<{
    format: string
    example: string
  }> => {
    const response = await api.get('/settings/dsn')
    return response.data
  },

  getApiKeys: async (): Promise<ApiKey[]> => {
    const response = await api.get('/settings/api-keys')
    return response.data.api_keys
  },

  createApiKey: async (name: string): Promise<ApiKeyCreateResponse> => {
    const response = await api.post('/settings/api-keys', { name })
    return response.data
  },

  revokeApiKey: async (keyId: string): Promise<void> => {
    await api.delete(`/settings/api-keys/${keyId}`)
  },
}

// User Analytics API
export const userAnalyticsApi = {
  getTopUsers: async (limit?: number, projectId?: string): Promise<UserStats[]> => {
    const response = await api.get('/stats/top-users', { params: { limit, project_id: projectId } })
    return response.data
  },

  getUserActivity: async (userId: string, params?: TimeSeriesParams & { project_id?: string }): Promise<UserActivityPoint[]> => {
    const response = await api.get('/stats/user-activity', { params: { user_id: userId, ...params } })
    return response.data
  },

  getUsersWithErrors: async (limit?: number, projectId?: string): Promise<UserWithErrors[]> => {
    const response = await api.get('/stats/users-with-errors', { params: { limit, project_id: projectId } })
    return response.data
  },
}

// Outbound API Monitoring
export const outboundApi = {
  getLogs: async (params: OutboundLogFilterParams): Promise<PaginatedResponse<OutboundLog>> => {
    const response = await api.get('/logs/outbound', { params })
    return response.data
  },

  getLog: async (id: string): Promise<OutboundLogDetail> => {
    const response = await api.get(`/logs/outbound/${id}`)
    return response.data
  },

  getServices: async (projectId?: string): Promise<string[]> => {
    const response = await api.get('/logs/outbound/services', { params: { project_id: projectId } })
    return response.data
  },

  getHosts: async (projectId?: string): Promise<string[]> => {
    const response = await api.get('/logs/outbound/hosts', { params: { project_id: projectId } })
    return response.data
  },

  getStats: async (projectId?: string): Promise<OutboundStats> => {
    const response = await api.get('/stats/outbound', { params: { project_id: projectId } })
    return response.data
  },

  getServiceHealth: async (projectId?: string): Promise<OutboundServiceHealth[]> => {
    const response = await api.get('/stats/outbound/by-service', { params: { project_id: projectId } })
    return response.data
  },

  getHostHealth: async (projectId?: string): Promise<OutboundHostHealth[]> => {
    const response = await api.get('/stats/outbound/by-host', { params: { project_id: projectId } })
    return response.data
  },

  getServiceEndpoints: async (serviceName: string, projectId?: string): Promise<OutboundEndpointStats[]> => {
    const response = await api.get(`/stats/outbound/services/${encodeURIComponent(serviceName)}/endpoints`, { params: { project_id: projectId } })
    return response.data
  },
}

// Inbound API Monitoring
export const inboundApi = {
  getLogs: async (params: InboundLogFilterParams): Promise<PaginatedResponse<InboundLog>> => {
    const response = await api.get('/logs/inbound', { params })
    return response.data
  },

  getLog: async (id: string): Promise<InboundLogDetail> => {
    const response = await api.get(`/logs/inbound/${id}`)
    return response.data
  },

  getEndpoints: async (projectId?: string): Promise<string[]> => {
    const response = await api.get('/logs/inbound/endpoints', { params: { project_id: projectId } })
    return response.data
  },

  getModules: async (projectId?: string): Promise<string[]> => {
    const response = await api.get('/logs/inbound/modules', { params: { project_id: projectId } })
    return response.data
  },

  getStats: async (projectId?: string): Promise<InboundStats> => {
    const response = await api.get('/stats/inbound', { params: { project_id: projectId } })
    return response.data
  },

  getModuleHealth: async (projectId?: string): Promise<InboundModuleHealth[]> => {
    const response = await api.get('/stats/inbound/by-module', { params: { project_id: projectId } })
    return response.data
  },

  getModuleEndpoints: async (moduleName: string, projectId?: string): Promise<InboundEndpointStats[]> => {
    const response = await api.get(`/stats/inbound/modules/${encodeURIComponent(moduleName)}/endpoints`, { params: { project_id: projectId } })
    return response.data
  },
}

export default api
