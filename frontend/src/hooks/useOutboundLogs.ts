import { useQuery } from '@tanstack/react-query'

import { outboundApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { CACHE_CONFIG } from '@/utils/constants'
import { useProjectId } from './useProjectId'

import type { OutboundLogFilterParams } from '@/types'

export function useOutboundLogs(params: OutboundLogFilterParams) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.outbound.logs(projectId!, params).queryKey,
    queryFn: () => outboundApi.getLogs({ ...params, project_id: projectId }),
    enabled: !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}

export function useOutboundLog(id: string) {
  return useQuery({
    queryKey: queryKeys.outbound.logDetail(id).queryKey,
    queryFn: () => outboundApi.getLog(id),
    enabled: !!id,
  })
}

export function useOutboundServices() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.outbound.services(projectId!).queryKey,
    queryFn: () => outboundApi.getServices(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.stable,
  })
}

export function useOutboundHosts() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.outbound.hosts(projectId!).queryKey,
    queryFn: () => outboundApi.getHosts(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.stable,
  })
}

export function useOutboundStats() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.outbound.stats(projectId!).queryKey,
    queryFn: () => outboundApi.getStats(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useOutboundServiceHealth() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.outbound.serviceHealth(projectId!).queryKey,
    queryFn: () => outboundApi.getServiceHealth(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useOutboundHostHealth() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.outbound.hostHealth(projectId!).queryKey,
    queryFn: () => outboundApi.getHostHealth(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useServiceEndpoints(serviceName: string | null) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.outbound.serviceEndpoints(projectId!, serviceName!).queryKey,
    queryFn: () => outboundApi.getServiceEndpoints(serviceName!, projectId),
    enabled: !!serviceName && !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}
