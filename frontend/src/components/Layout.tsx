import { ReactNode, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar, Header, StatusBar, SIDEBAR_STORAGE_KEY } from './layoutComponents'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    return stored ? JSON.parse(stored) : false
  })

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
