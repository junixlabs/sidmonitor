import { useQuery } from '@tanstack/react-query'
import { logApi } from '../api/client'
import type { FilterParams } from '../types'

export function useLogs(params: FilterParams) {
  return useQuery({
    queryKey: ['logs', params],
    queryFn: () => logApi.getLogs(params),
  })
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => logApi.getStats(),
    refetchInterval: 30000,
  })
}

export function useModules() {
  return useQuery({
    queryKey: ['modules'],
    queryFn: () => logApi.getModules(),
  })
}

export function useEndpoints() {
  return useQuery({
    queryKey: ['endpoints'],
    queryFn: () => logApi.getEndpoints(),
  })
}
