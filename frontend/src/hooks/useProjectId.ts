import { useWorkspaceStore } from '@/stores/workspaceStore'

export function useProjectId(): string | undefined {
  return useWorkspaceStore((s) => s.currentProject?.id)
}
