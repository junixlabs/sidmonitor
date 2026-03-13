import { useEffect } from 'react'
import { useParams, Navigate, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { orgApi, projectApi } from '@/api/client'
import { CACHE_CONFIG } from '@/utils/constants'
import Layout from '@/components/Layout'

export default function ProjectLayout() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>()
  const currentOrg = useWorkspaceStore((s) => s.currentOrg)
  const currentProject = useWorkspaceStore((s) => s.currentProject)
  const switchProject = useWorkspaceStore((s) => s.switchProject)
  const setProjects = useWorkspaceStore((s) => s.setProjects)

  // Resolve org from URL slug (skip if already loaded)
  const orgQuery = useQuery({
    queryKey: ['org', orgSlug],
    queryFn: () => orgApi.get(orgSlug!),
    enabled: !!orgSlug && currentOrg?.slug !== orgSlug,
    ...CACHE_CONFIG.stable,
  })

  // Load projects for org
  const projectsQuery = useQuery({
    queryKey: ['projects', orgSlug],
    queryFn: () => projectApi.list(orgSlug!),
    enabled: !!orgSlug,
    ...CACHE_CONFIG.stable,
  })

  // Sync resolved org to workspace store
  useEffect(() => {
    if (orgQuery.data && currentOrg?.slug !== orgSlug) {
      // Use direct store access to avoid clearing project/projects prematurely
      useWorkspaceStore.setState({ currentOrg: orgQuery.data })
    }
  }, [orgQuery.data, orgSlug, currentOrg?.slug])

  // Sync resolved project to workspace store
  useEffect(() => {
    if (projectsQuery.data) {
      setProjects(projectsQuery.data)
      const project = projectsQuery.data.find((p) => p.slug === projectSlug)
      if (project && currentProject?.slug !== projectSlug) {
        switchProject(project)
      }
    }
  }, [projectsQuery.data, projectSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle invalid project slug — redirect to project list
  if (projectsQuery.data && !projectsQuery.data.find((p) => p.slug === projectSlug)) {
    return <Navigate to={`/${orgSlug}/projects`} replace />
  }

  // Handle invalid org slug
  if (orgQuery.error) {
    return <Navigate to="/organizations" replace />
  }

  // Loading state — show layout skeleton
  if (!currentProject || currentProject.slug !== projectSlug) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-text-muted">Loading project...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
