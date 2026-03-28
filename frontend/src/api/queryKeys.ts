import { createQueryKeyStore } from '@lukemorales/query-key-factory'

import type {
  FilterParams,
  TimeSeriesParams,
  DashboardTab,
  JobFilterParams,
  ScheduledTaskFilterParams,
  InboundLogFilterParams,
  OutboundLogFilterParams,
} from '@/types'

export const queryKeys = createQueryKeyStore({
  // -- Logs & general stats --
  logs: {
    list: (projectId: string, params: FilterParams) => [projectId, params],
    detail: (id: string) => [id],
  },
  stats: {
    summary: (projectId: string, type?: DashboardTab, startDate?: string, endDate?: string) => [projectId, type, startDate, endDate],
    health: (projectId: string) => [projectId],
    tabCounts: (projectId: string) => [projectId],
    global: null,
  },
  timeSeries: {
    requests: (projectId: string, params?: TimeSeriesParams, type?: DashboardTab) => [projectId, params, type],
  },
  topEndpoints: {
    list: (projectId: string, limit: number, type?: DashboardTab, startDate?: string, endDate?: string) => [projectId, limit, type, startDate, endDate],
  },
  serviceHealth: {
    list: (projectId: string) => [projectId],
  },
  moduleHealth: {
    list: (projectId: string, type?: DashboardTab) => [projectId, type],
  },

  // -- Traffic analytics --
  traffic: {
    byMethod: (projectId: string, type?: DashboardTab) => [projectId, type],
    peakHours: (projectId: string, type?: DashboardTab) => [projectId, type],
    byDay: (projectId: string, type?: DashboardTab) => [projectId, type],
    throughput: (projectId: string, type?: DashboardTab) => [projectId, type],
  },

  // -- Performance analytics --
  performance: {
    percentiles: (projectId: string, type?: DashboardTab) => [projectId, type],
    slowRequests: (projectId: string, type?: DashboardTab) => [projectId, type],
    timeline: (projectId: string, params?: TimeSeriesParams, type?: DashboardTab) => [projectId, params, type],
  },

  // -- Error analytics --
  errors: {
    breakdown: (projectId: string, type?: DashboardTab) => [projectId, type],
    endpoints: (projectId: string, limit: number, type?: DashboardTab) => [projectId, limit, type],
    timeline: (projectId: string, params?: TimeSeriesParams, type?: DashboardTab) => [projectId, params, type],
    groups: (projectId: string, startDate?: string, endDate?: string, statusCategory?: string) => [projectId, startDate, endDate, statusCategory],
  },

  // -- User analytics --
  users: {
    top: (projectId: string, limit: number) => [projectId, limit],
    activity: (projectId: string, userId: string, params?: TimeSeriesParams) => [projectId, userId, params],
    withErrors: (projectId: string, limit: number) => [projectId, limit],
  },

  // -- Inbound APIs --
  inbound: {
    logs: (projectId: string, params: InboundLogFilterParams) => [projectId, params],
    logDetail: (id: string) => [id],
    endpoints: (projectId: string) => [projectId],
    modules: (projectId: string) => [projectId],
    stats: (projectId: string) => [projectId],
    moduleHealth: (projectId: string) => [projectId],
    moduleEndpoints: (projectId: string, moduleName: string) => [projectId, moduleName],
  },

  // -- Outbound APIs --
  outbound: {
    logs: (projectId: string, params: OutboundLogFilterParams) => [projectId, params],
    logDetail: (id: string) => [id],
    services: (projectId: string) => [projectId],
    hosts: (projectId: string) => [projectId],
    stats: (projectId: string) => [projectId],
    serviceHealth: (projectId: string) => [projectId],
    hostHealth: (projectId: string) => [projectId],
    serviceEndpoints: (projectId: string, serviceName: string) => [projectId, serviceName],
  },

  // -- Jobs --
  jobs: {
    list: (projectId: string, params: Omit<JobFilterParams, 'project_id'>) => [projectId, params],
    stats: (projectId: string, timeframe: string) => [projectId, timeframe],
    timeline: (projectId: string, timeframe: string, interval: string) => [projectId, timeframe, interval],
  },

  // -- Scheduled tasks --
  scheduledTasks: {
    list: (projectId: string, params: Omit<ScheduledTaskFilterParams, 'project_id'>) => [projectId, params],
    stats: (projectId: string, timeframe: string) => [projectId, timeframe],
  },

  // -- Project settings --
  project: {
    apiKeys: (projectSlug: string) => [projectSlug],
  },

  // -- Static reference data (no projectId) --
  modules: {
    list: null,
  },
  endpoints: {
    list: null,
    detail: (projectId: string, endpoint: string, method: string, startDate?: string, endDate?: string) => [projectId, endpoint, method, startDate, endDate],
  },
})
