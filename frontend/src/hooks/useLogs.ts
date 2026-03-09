import { useQuery } from '@tanstack/react-query'

import { logApi, projectApi, userAnalyticsApi } from '@/api/client'
import { CACHE_CONFIG } from '@/utils/constants'
import { useProjectId } from './useProjectId'
import { useAuth } from '@/contexts/AuthContext'

import type { FilterParams, TimeSeriesParams, DashboardTab } from '@/types'

export function useLogs(params: FilterParams) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['logs', params, projectId],
    queryFn: () => logApi.getLogs({ ...params, project_id: projectId }),
    enabled: !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}

export function useLog(id: string) {
  return useQuery({
    queryKey: ['log', id],
    queryFn: () => logApi.getLog(id),
    enabled: !!id,
  })
}

export function useStats(type?: DashboardTab, startDate?: string, endDate?: string) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['stats', projectId, type, startDate, endDate],
    queryFn: () => logApi.getStats(projectId, type, startDate, endDate),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useModules() {
  return useQuery({
    queryKey: ['modules'],
    queryFn: () => logApi.getModules(),
    ...CACHE_CONFIG.stable,
  })
}

export function useEndpoints() {
  return useQuery({
    queryKey: ['endpoints'],
    queryFn: () => logApi.getEndpoints(),
  })
}

export function useTimeSeries(params?: TimeSeriesParams, type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['timeSeries', params, projectId, type],
    queryFn: () => logApi.getTimeSeries({ ...params, project_id: projectId }, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useTopEndpoints(limit = 10, type?: DashboardTab, startDate?: string, endDate?: string) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['topEndpoints', limit, projectId, type, startDate, endDate],
    queryFn: () => logApi.getTopEndpoints(limit, projectId, type, startDate, endDate),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useServiceHealth() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['serviceHealth', projectId],
    queryFn: () => logApi.getServiceHealth(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useModuleHealth(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['moduleHealth', projectId, type],
    queryFn: () => logApi.getModuleHealth(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useTabCounts() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['tabCounts', projectId],
    queryFn: () => logApi.getTabCounts(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useProjectApiKeys(projectSlug: string) {
  return useQuery({
    queryKey: ['projectApiKeys', projectSlug],
    queryFn: () => projectApi.listApiKeys(projectSlug),
    enabled: !!projectSlug,
  })
}

export function useCurrentProject() {
  const { currentProject } = useAuth()
  return currentProject
}

export function useTrafficByMethod(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['trafficByMethod', projectId, type],
    queryFn: () => logApi.getTrafficByMethod(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function usePeakHours(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['peakHours', projectId, type],
    queryFn: () => logApi.getPeakHours(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useTrafficByDay(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['trafficByDay', projectId, type],
    queryFn: () => logApi.getTrafficByDay(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useThroughput(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['throughput', projectId, type],
    queryFn: () => logApi.getThroughput(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function usePerformancePercentiles(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['performancePercentiles', projectId, type],
    queryFn: () => logApi.getPerformancePercentiles(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useSlowRequests(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['slowRequests', projectId, type],
    queryFn: () => logApi.getSlowRequests(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function usePerformanceTimeline(params?: TimeSeriesParams, type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['performanceTimeline', params, projectId, type],
    queryFn: () => logApi.getPerformanceTimeline({ ...params, project_id: projectId }, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useErrorBreakdown(type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['errorBreakdown', projectId, type],
    queryFn: () => logApi.getErrorBreakdown(projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useErrorEndpoints(limit = 10, type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['errorEndpoints', limit, projectId, type],
    queryFn: () => logApi.getErrorEndpoints(limit, projectId, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useErrorTimeline(params?: TimeSeriesParams, type?: DashboardTab) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['errorTimeline', params, projectId, type],
    queryFn: () => logApi.getErrorTimeline({ ...params, project_id: projectId }, type),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useTopUsers(limit = 10) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['topUsers', limit, projectId],
    queryFn: () => userAnalyticsApi.getTopUsers(limit, projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useUserActivity(userId: string, params?: TimeSeriesParams) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['userActivity', userId, params, projectId],
    queryFn: () => userAnalyticsApi.getUserActivity(userId, { ...params, project_id: projectId }),
    enabled: !!projectId && !!userId,
    ...CACHE_CONFIG.standard,
  })
}

export function useUsersWithErrors(limit = 10) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['usersWithErrors', limit, projectId],
    queryFn: () => userAnalyticsApi.getUsersWithErrors(limit, projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.analytics,
  })
}

export function useGlobalStats() {
  return useQuery({
    queryKey: ['globalStats'],
    queryFn: () => logApi.getGlobalStats(),
    ...CACHE_CONFIG.analytics,
  })
}
