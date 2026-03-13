import { useWorkspaceStore } from '@/stores/workspaceStore'

export function useProjectUrl() {
  const currentOrg = useWorkspaceStore((s) => s.currentOrg)
  const currentProject = useWorkspaceStore((s) => s.currentProject)

  return (page: string) => {
    if (!currentOrg || !currentProject) return '/organizations'
    return `/${currentOrg.slug}/${currentProject.slug}/${page}`
  }
}
