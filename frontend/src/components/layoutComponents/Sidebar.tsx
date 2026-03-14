import { useState, useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  LayoutDashboard,
  Inbox,
  ArrowRight,
  Briefcase,
  Clock,
  Settings,
  BarChart3,
  ChevronsLeft,
  Sparkles,
  Building,
  Globe,
  CircleHelp,
} from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface NavItem {
  /** Relative page name (e.g. 'dashboard') or absolute path (e.g. '/whats-new') */
  page: string
  label: string
  icon: React.ReactNode
  absolute?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const projectNavGroups: NavGroup[] = [
  {
    label: 'Monitoring',
    items: [
      {
        page: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-5 h-5" />,
      },
      {
        page: 'inbound-apis',
        label: 'Inbound APIs',
        icon: <Inbox className="w-5 h-5" />,
      },
      {
        page: 'outbound-apis',
        label: 'Outbound APIs',
        icon: <ArrowRight className="w-5 h-5" />,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        page: 'jobs',
        label: 'Jobs',
        icon: <Briefcase className="w-5 h-5" />,
      },
      {
        page: 'scheduled-tasks',
        label: 'Scheduler',
        icon: <Clock className="w-5 h-5" />,
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        page: 'settings',
        label: 'Settings',
        icon: <Settings className="w-5 h-5" />,
      },
    ],
  },
]

const globalNavGroups: NavGroup[] = [
  {
    label: 'Navigation',
    items: [
      {
        page: '/',
        label: 'Overview',
        icon: <Globe className="w-5 h-5" />,
        absolute: true,
      },
      {
        page: '/organizations',
        label: 'Organizations',
        icon: <Building className="w-5 h-5" />,
        absolute: true,
      },
    ],
  },
]

import { SIDEBAR_STORAGE_KEY } from './constants'

const bottomItems: NavItem[] = [
  {
    page: '/whats-new',
    label: "What's New",
    icon: <Sparkles className="w-5 h-5" />,
    absolute: true,
  },
  {
    page: '/docs',
    label: 'Help & Docs',
    icon: <CircleHelp className="w-5 h-5" />,
    absolute: true,
  },
]

const globalPaths = ['/', '/organizations', '/whats-new', '/docs', '/settings/account']
const orgSettingsPattern = /^\/[^/]+\/settings$/

function NavItemLink({
  item,
  linkPath,
  isActive,
  collapsed,
  hoveredItem,
  setHoveredItem,
  py = 'py-2.5',
}: {
  item: NavItem
  linkPath: string
  isActive: boolean
  collapsed: boolean
  hoveredItem: string | null
  setHoveredItem: (v: string | null) => void
  py?: string
}) {
  const isHovered = hoveredItem === item.page
  return (
    <li className="relative">
      <Link
        to={linkPath}
        onMouseEnter={() => setHoveredItem(item.page)}
        onMouseLeave={() => setHoveredItem(null)}
        className={cn(
          `flex items-center gap-3 px-3 ${py} rounded-lg`,
          'transition-colors duration-150',
          isActive
            ? 'bg-sidebar-active text-white'
            : isHovered
            ? 'bg-sidebar-hover text-white'
            : 'text-sidebar-muted',
          collapsed && 'justify-center'
        )}
        title={collapsed ? item.label : undefined}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {!collapsed && (
          <span className="text-sm font-medium whitespace-nowrap">
            {item.label}
          </span>
        )}
      </Link>

      {collapsed && isHovered && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap z-50 bg-sidebar-hover text-sidebar-text">
          {item.label}
        </div>
      )}
    </li>
  )
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const currentOrg = useWorkspaceStore((s) => s.currentOrg)
  const currentProject = useWorkspaceStore((s) => s.currentProject)

  const projectBase = useMemo(() => {
    if (currentOrg && currentProject) {
      return `/${currentOrg.slug}/${currentProject.slug}`
    }
    return null
  }, [currentOrg, currentProject])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(collapsed))
  }, [collapsed])

  const resolveLink = (item: NavItem): string => {
    if (item.absolute) return item.page
    if (projectBase) return `${projectBase}/${item.page}`
    return `/organizations` // fallback — no project selected
  }

  const isItemActive = (item: NavItem): boolean => {
    const resolved = resolveLink(item)
    return location.pathname === resolved || location.pathname.endsWith(`/${item.page}`)
  }

  // Show project nav only when on a project-scoped route (/:orgSlug/:projectSlug/*)
  const isGlobalPage = globalPaths.includes(location.pathname) || location.pathname.startsWith('/organizations') || orgSettingsPattern.test(location.pathname)
  const hasProject = !!(currentOrg && currentProject) && !isGlobalPage
  const navGroups = hasProject ? projectNavGroups : globalNavGroups

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen z-40',
        'flex flex-col bg-sidebar',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo area */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-muted/20">
        <Link to="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sidebar-text text-lg whitespace-nowrap">
              SidMonitor
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-6">
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-muted">
                {group.label}
              </h3>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <NavItemLink
                  key={item.page}
                  item={item}
                  linkPath={resolveLink(item)}
                  isActive={isItemActive(item)}
                  collapsed={collapsed}
                  hoveredItem={hoveredItem}
                  setHoveredItem={setHoveredItem}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pinned bottom links */}
      <div className="px-2 pb-1">
        <ul className="space-y-1">
          {bottomItems.map((item) => (
            <NavItemLink
              key={item.page}
              item={item}
              linkPath={resolveLink(item)}
              isActive={isItemActive(item)}
              collapsed={collapsed}
              hoveredItem={hoveredItem}
              setHoveredItem={setHoveredItem}
              py="py-2"
            />
          ))}
        </ul>
      </div>

      {/* Collapse toggle button */}
      <div className="p-2 border-t border-sidebar-muted/20">
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'transition-colors duration-150',
            'text-sidebar-muted hover:bg-sidebar-hover',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronsLeft
            className={cn(
              'w-5 h-5 transition-transform duration-300',
              collapsed && 'rotate-180'
            )}
          />
          {!collapsed && (
            <span className="text-sm font-medium">Collapse</span>
          )}
        </button>
      </div>
    </aside>
  )
}
