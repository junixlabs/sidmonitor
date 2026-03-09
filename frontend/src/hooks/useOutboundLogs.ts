import { useQuery } from '@tanstack/react-query'

import { outboundApi } from '@/api/client'
import { CACHE_CONFIG } from '@/utils/constants'
import { useProjectId } from './useProjectId'

import type { OutboundLogFilterParams } from '@/types'

export function useOutboundLogs(params: OutboundLogFilterParams) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['outboundLogs', params, projectId],
    queryFn: () => outboundApi.getLogs({ ...params, project_id: projectId }),
    enabled: !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}

export function useOutboundLog(id: string) {
  return useQuery({
    queryKey: ['outboundLog', id],
    queryFn: () => outboundApi.getLog(id),
    enabled: !!id,
  })
}

export function useOutboundServices() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['outboundServices', projectId],
    queryFn: () => outboundApi.getServices(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.stable,
  })
}

export function useOutboundHosts() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['outboundHosts', projectId],
    queryFn: () => outboundApi.getHosts(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.stable,
  })
}

export function useOutboundStats() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['outboundStats', projectId],
    queryFn: () => outboundApi.getStats(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useOutboundServiceHealth() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['outboundServiceHealth', projectId],
    queryFn: () => outboundApi.getServiceHealth(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useOutboundHostHealth() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['outboundHostHealth', projectId],
    queryFn: () => outboundApi.getHostHealth(projectId),
    enabled: !!projectId,
    ...CACHE_CONFIG.standard,
  })
}

export function useServiceEndpoints(serviceName: string | null) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['serviceEndpoints', serviceName, projectId],
    queryFn: () => outboundApi.getServiceEndpoints(serviceName!, projectId),
    enabled: !!serviceName && !!projectId,
    staleTime: CACHE_CONFIG.standard.staleTime,
    gcTime: CACHE_CONFIG.standard.gcTime,
  })
}
