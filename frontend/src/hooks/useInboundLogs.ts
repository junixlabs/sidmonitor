import { useQuery } from '@tanstack/react-query'

import { inboundApi } from '@/api/client'
import { CACHE_CONFIG } from '@/utils/constants'
import { useProjectId } from './useProjectId'

import type { InboundLogFilterParams } from '@/types'

export function useInboundLogs(params: InboundLogFilterParams) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['inboundLogs', params, projectId],
    queryFn: () => inboundApi.getLogs({ ...params, project_id: projectId }),
    enabled: !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}

export function useInboundLog(id: string) {
  return useQuery({
    queryKey: ['inboundLog', id],
    queryFn: () => inboundApi.getLog(id),
    enabled: !!id,
  })
}

export function useInboundEndpoints() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['inboundEndpoints', projectId],
    queryFn: () => inboundApi.getEndpoints(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.stable,
  })
}

export function useInboundModules() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['inboundModules', projectId],
    queryFn: () => inboundApi.getModules(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.stable,
  })
}

export function useInboundStats() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['inboundStats', projectId],
    queryFn: () => inboundApi.getStats(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useInboundModuleHealth() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['inboundModuleHealth', projectId],
    queryFn: () => inboundApi.getModuleHealth(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useModuleEndpoints(moduleName: string | null) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['moduleEndpoints', moduleName, projectId],
    queryFn: () => inboundApi.getModuleEndpoints(moduleName!, projectId),
    enabled: !!moduleName && !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}
