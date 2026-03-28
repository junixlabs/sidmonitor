import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { savedViewsApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useProjectId } from './useProjectId'

import type { FilterParams } from '@/types'

export function useSavedViews() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: queryKeys.savedViews.list(projectId!).queryKey,
    queryFn: () => savedViewsApi.list(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  })
}

export function useCreateSavedView() {
  const projectId = useProjectId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; filters: FilterParams; color?: string; is_default?: boolean }) =>
      savedViewsApi.create(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedViews.list(projectId!).queryKey })
    },
  })
}

export function useUpdateSavedView() {
  const projectId = useProjectId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ viewId, data }: { viewId: string; data: { name?: string; filters?: FilterParams; color?: string; is_default?: boolean } }) =>
      savedViewsApi.update(viewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedViews.list(projectId!).queryKey })
    },
  })
}

export function useDeleteSavedView() {
  const projectId = useProjectId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (viewId: string) => savedViewsApi.delete(viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedViews.list(projectId!).queryKey })
    },
  })
}
