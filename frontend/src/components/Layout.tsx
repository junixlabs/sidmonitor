import { ReactNode, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar, Header, StatusBar, SIDEBAR_STORAGE_KEY } from './layoutComponents'
import { useAuth } from '../contexts/AuthContext'
import { orgApi, projectApi } from '../api/client'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { currentOrg, currentProject, projects, setProjects, setCurrentOrg, setCurrentProject, setOrganizations } = useAuth()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    return stored ? JSON.parse(stored) : false
  })

  // Auto-load projects when org is set but projects list is empty
  useEffect(() => {
    if (!currentOrg?.slug || projects.length > 0) return

    projectApi.list(currentOrg.slug).then((loaded) => {
      setProjects(loaded)
      // If currentProject is stale (not in loaded list), reset to first project
      if (currentProject && !loaded.find(p => p.id === currentProject.id) && loaded.length > 0) {
        setCurrentProject(loaded[0])
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
            setCurrentProject(orgProjects[0])
          }
        }
      } catch {
        // If everything fails, clear stale context
        setCurrentOrg(null)
        setCurrentProject(null)
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
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev: boolean) => !prev)}
      />
      <Header sidebarCollapsed={sidebarCollapsed} />
      <main
        className={cn(
          'pt-14 pb-8 transition-all duration-300',
          sidebarCollapsed ? 'pl-16' : 'pl-60'
        )}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
      <StatusBar sidebarCollapsed={sidebarCollapsed} />
    </div>
  )
}
