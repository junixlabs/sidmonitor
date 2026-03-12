import { useQuery } from '@tanstack/react-query'

import { jobApi } from '@/api/client'
import { CACHE_CONFIG } from '@/utils/constants'
import { useProjectId } from './useProjectId'

import type { JobFilterParams, ScheduledTaskFilterParams } from '@/types'

export function useJobTimeline(timeframe = '24h', interval = 'hour') {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['jobTimeline', projectId, timeframe, interval],
    queryFn: () => jobApi.getJobTimeline(projectId!, timeframe, interval),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useJobs(params: Omit<JobFilterParams, 'project_id'>) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['jobs', params, projectId],
    queryFn: () => jobApi.getJobs({ ...params, project_id: projectId }),
    enabled: !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}

export function useJobStats(timeframe = '24h') {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['jobStats', projectId, timeframe],
    queryFn: () => jobApi.getJobStats(projectId!, timeframe),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useScheduledTasks(params: Omit<ScheduledTaskFilterParams, 'project_id'>) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['scheduledTasks', params, projectId],
    queryFn: () => jobApi.getScheduledTasks({ ...params, project_id: projectId }),
    enabled: !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}

export function useScheduledTaskStats(timeframe = '7d') {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['scheduledTaskStats', projectId, timeframe],
    queryFn: () => jobApi.getScheduledTaskStats(projectId!, timeframe),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}
