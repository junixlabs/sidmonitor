import { ReactNode, useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Sidebar, Header, StatusBar, SIDEBAR_STORAGE_KEY } from './layoutComponents'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { orgApi, projectApi } from '../api/client'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const currentOrg = useWorkspaceStore((s) => s.currentOrg)
  const currentProject = useWorkspaceStore((s) => s.currentProject)
  const projects = useWorkspaceStore((s) => s.projects)
  const setProjects = useWorkspaceStore((s) => s.setProjects)
  const setCurrentOrg = useWorkspaceStore((s) => s.setCurrentOrg)
  const switchProject = useWorkspaceStore((s) => s.switchProject)
  const setOrganizations = useWorkspaceStore((s) => s.setOrganizations)
  const location = useLocation()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    return stored ? JSON.parse(stored) : false
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const organizations = useWorkspaceStore((s) => s.organizations)

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleMobileToggle = useCallback(() => {
    setMobileOpen((prev) => !prev)
  }, [])

  // Auto-load organizations when store has none
  useEffect(() => {
    if (organizations.length > 0) return
    orgApi.list().then((orgs) => {
      setOrganizations(orgs)
      // If no org is selected, auto-select the first one
      if (!currentOrg && orgs.length > 0) {
        setCurrentOrg(orgs[0])
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load projects when org is set but projects list is empty
  useEffect(() => {
    if (!currentOrg?.slug || projects.length > 0) return

    projectApi.list(currentOrg.slug).then((loaded) => {
      setProjects(loaded)
      // If currentProject is stale (not in loaded list), reset to first project
      if (currentProject && !loaded.find(p => p.id === currentProject.id) && loaded.length > 0) {
        switchProject(loaded[0])
      }
    }).catch(async () => {
      // Org slug is stale/invalid — load user's actual orgs and reset context
      try {
        const orgs = await orgApi.list()
        setOrganizations(orgs)
        if (orgs.length > 0) {
          const org = orgs[0]
          setCurrentOrg(org)
          const orgProjects = await projectApi.list(org.slug)
          setProjects(orgProjects)
          if (orgProjects.length > 0) {
            switchProject(orgProjects[0])
          }
        }
      } catch {
        // If everything fails, clear stale context
        setCurrentOrg(null)
        switchProject(null)
      }
    })
  }, [currentOrg?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarCollapsed((prev: boolean) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: hidden on mobile unless mobileOpen is true */}
      <div className={cn(
        'md:block',
        mobileOpen ? 'block' : 'hidden'
      )}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev: boolean) => !prev)}
        />
      </div>

      <Header sidebarCollapsed={sidebarCollapsed} onMobileMenuToggle={handleMobileToggle} />
      <main
        className={cn(
          'pt-14 pb-8 transition-all duration-300',
          // On mobile, no left padding (sidebar is overlay)
          'pl-0',
          // On desktop, respect sidebar state
          sidebarCollapsed ? 'md:pl-16' : 'md:pl-60'
        )}
      >
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
      <StatusBar sidebarCollapsed={sidebarCollapsed} />
    </div>
  )
}
