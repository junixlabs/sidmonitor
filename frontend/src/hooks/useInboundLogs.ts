import { useQuery } from '@tanstack/react-query'

import { inboundApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { CACHE_CONFIG } from '@/utils/constants'
import { useProjectId } from './useProjectId'

import type { InboundLogFilterParams } from '@/types'

export function useInboundLogs(params: InboundLogFilterParams) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.inbound.logs(projectId!, params).queryKey,
    queryFn: () => inboundApi.getLogs({ ...params, project_id: projectId }),
    enabled: !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}

export function useInboundLog(id: string) {
  return useQuery({
    queryKey: queryKeys.inbound.logDetail(id).queryKey,
    queryFn: () => inboundApi.getLog(id),
    enabled: !!id,
  })
}

export function useInboundEndpoints() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.inbound.endpoints(projectId!).queryKey,
    queryFn: () => inboundApi.getEndpoints(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.stable,
  })
}

export function useInboundModules() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.inbound.modules(projectId!).queryKey,
    queryFn: () => inboundApi.getModules(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.stable,
  })
}

export function useInboundStats() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.inbound.stats(projectId!).queryKey,
    queryFn: () => inboundApi.getStats(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useInboundModuleHealth() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.inbound.moduleHealth(projectId!).queryKey,
    queryFn: () => inboundApi.getModuleHealth(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useModuleEndpoints(moduleName: string | null) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.inbound.moduleEndpoints(projectId!, moduleName!).queryKey,
    queryFn: () => inboundApi.getModuleEndpoints(moduleName!, projectId),
    enabled: !!moduleName && !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}
