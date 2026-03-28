import { useQuery } from '@tanstack/react-query'

import { logApi, projectApi, userAnalyticsApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { CACHE_CONFIG } from '@/utils/constants'
import { useProjectId } from './useProjectId'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import type { FilterParams, TimeSeriesParams, DashboardTab } from '@/types'

export function useLogs(params: FilterParams) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.logs.list(projectId!, params).queryKey,
    queryFn: () => logApi.getLogs({ ...params, project_id: projectId }),
    enabled: !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}

export function useLog(id: string) {
  return useQuery({
    queryKey: queryKeys.logs.detail(id).queryKey,
    queryFn: () => logApi.getLog(id),
    enabled: !!id,
  })
}

export function useStats(type?: DashboardTab, startDate?: string, endDate?: string) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.stats.summary(projectId!, type, startDate, endDate).queryKey,
    queryFn: () => logApi.getStats(projectId, type, startDate, endDate),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useModules() {
  return useQuery({
    queryKey: queryKeys.modules.list.queryKey,
    queryFn: () => logApi.getModules(),
    ...CACHE_CONFIG.stable,
  })
}

export function useEndpoints() {
  return useQuery({
    queryKey: queryKeys.endpoints.list.queryKey,
    queryFn: () => logApi.getEndpoints(),
  })
}

export function useTimeSeries(params?: TimeSeriesParams, type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.timeSeries.requests(projectId!, params, type).queryKey,
    queryFn: () => logApi.getTimeSeries({ ...params, project_id: projectId }, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useTopEndpoints(limit = 10, type?: DashboardTab, startDate?: string, endDate?: string) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.topEndpoints.list(projectId!, limit, type, startDate, endDate).queryKey,
    queryFn: () => logApi.getTopEndpoints(limit, projectId, type, startDate, endDate),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useServiceHealth() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.serviceHealth.list(projectId!).queryKey,
    queryFn: () => logApi.getServiceHealth(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useModuleHealth(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.moduleHealth.list(projectId!, type).queryKey,
    queryFn: () => logApi.getModuleHealth(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useTabCounts() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.stats.tabCounts(projectId!).queryKey,
    queryFn: () => logApi.getTabCounts(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useProjectApiKeys(projectSlug: string) {
  return useQuery({
    queryKey: queryKeys.project.apiKeys(projectSlug).queryKey,
    queryFn: () => projectApi.listApiKeys(projectSlug),
    enabled: !!projectSlug,
  })
}

export function useCurrentProject() {
  return useWorkspaceStore((s) => s.currentProject)
}

export function useTrafficByMethod(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.traffic.byMethod(projectId!, type).queryKey,
    queryFn: () => logApi.getTrafficByMethod(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function usePeakHours(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.traffic.peakHours(projectId!, type).queryKey,
    queryFn: () => logApi.getPeakHours(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useTrafficByDay(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.traffic.byDay(projectId!, type).queryKey,
    queryFn: () => logApi.getTrafficByDay(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useThroughput(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.traffic.throughput(projectId!, type).queryKey,
    queryFn: () => logApi.getThroughput(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function usePerformancePercentiles(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.performance.percentiles(projectId!, type).queryKey,
    queryFn: () => logApi.getPerformancePercentiles(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useSlowRequests(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.performance.slowRequests(projectId!, type).queryKey,
    queryFn: () => logApi.getSlowRequests(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function usePerformanceTimeline(params?: TimeSeriesParams, type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.performance.timeline(projectId!, params, type).queryKey,
    queryFn: () => logApi.getPerformanceTimeline({ ...params, project_id: projectId }, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useErrorBreakdown(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.errors.breakdown(projectId!, type).queryKey,
    queryFn: () => logApi.getErrorBreakdown(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useErrorEndpoints(limit = 10, type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.errors.endpoints(projectId!, limit, type).queryKey,
    queryFn: () => logApi.getErrorEndpoints(limit, projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useErrorTimeline(params?: TimeSeriesParams, type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.errors.timeline(projectId!, params, type).queryKey,
    queryFn: () => logApi.getErrorTimeline({ ...params, project_id: projectId }, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useTopUsers(limit = 10) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.users.top(projectId!, limit).queryKey,
    queryFn: () => userAnalyticsApi.getTopUsers(limit, projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useUserActivity(userId: string, params?: TimeSeriesParams) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.users.activity(projectId!, userId, params).queryKey,
    queryFn: () => userAnalyticsApi.getUserActivity(userId, { ...params, project_id: projectId }),
    enabled: !!projectId && !!userId,
    ...CACHE_CONFIG.standard,
  })
}

export function useUsersWithErrors(limit = 10) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.users.withErrors(projectId!, limit).queryKey,
    queryFn: () => userAnalyticsApi.getUsersWithErrors(limit, projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useGlobalStats(timeRange?: string) {
  return useQuery({
    queryKey: [...queryKeys.stats.global.queryKey, timeRange ?? '24h'],
    queryFn: () => logApi.getGlobalStats(timeRange),
    ...CACHE_CONFIG.analytics,
  })
}

export function useEndpointDetail(endpoint: string, method: string, startDate?: string, endDate?: string) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.endpoints.detail(projectId!, endpoint, method, startDate, endDate).queryKey,
    queryFn: () => logApi.getEndpointDetail(endpoint, method, projectId, startDate, endDate),
    enabled: !!projectId && !!endpoint && !!method,
    ...CACHE_CONFIG.standard,
  })
}

export function useErrorGroups(startDate?: string, endDate?: string, statusCategory?: string) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.errors.groups(projectId!, startDate, endDate, statusCategory).queryKey,
    queryFn: () => logApi.getErrorGroups(projectId, startDate, endDate, statusCategory),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}
