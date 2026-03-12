import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useHealthAlerts } from '@/hooks/useHealthAlerts'
import {
  ChevronDown,
  Search,
  AlertTriangle,
  Bell,
  Moon,
  Sun,
  Check,
  CheckCircle,
  LayoutGrid,
  Building,
  Settings,
  LogOut,
} from 'lucide-react'

interface HeaderProps {
  sidebarCollapsed: boolean
}

export default function Header({ sidebarCollapsed }: HeaderProps) {
  const navigate = useNavigate()
  const { user, currentOrg, currentProject, projects, setCurrentProject, logout } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()

  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set())

  const userMenuRef = useRef<HTMLDivElement>(null)
  const projectMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleProjectSwitch = (project: typeof currentProject) => {
    setCurrentProject(project)
    setShowProjectMenu(false)
    window.location.reload()
  }

  const { alerts } = useHealthAlerts()
  const unreadAlerts = alerts.filter((a) => !readAlertIds.has(a.id))
  const unreadCriticalCount = unreadAlerts.filter((a) => a.severity === 'critical').length
  const notificationCount = unreadAlerts.length

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-14 z-30',
        'flex items-center justify-between px-4',
        'border-b transition-all duration-300'
      )}
      style={{
        left: sidebarCollapsed ? '64px' : '240px',
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* Left section - Project selector */}
      <div className="flex items-center gap-4">
        {currentOrg && currentProject && (
          <div className="relative" ref={projectMenuRef}>
            <button
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="font-medium">{currentOrg.name}</span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span className="font-medium">{currentProject.name}</span>
              <ChevronDown
                className={cn('w-4 h-4 transition-transform', showProjectMenu && 'rotate-180')}
                style={{ color: 'var(--text-muted)' }}
              />
              {projects.length > 1 && (
                <span
                  className="ml-1 px-1.5 py-0.5 text-xs rounded-full font-medium"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'white',
                  }}
                >
                  {projects.length}
                </span>
              )}
            </button>

            {showProjectMenu && (
              <div
                className="absolute left-0 mt-2 w-72 rounded-lg shadow-lg py-1 z-50 border"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                <div
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b"
                  style={{
                    color: 'var(--text-muted)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  Switch Project
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectSwitch(project)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-sm transition-colors',
                        currentProject.id === project.id && 'font-medium'
                      )}
                      style={{
                        backgroundColor: currentProject.id === project.id ? 'var(--bg-tertiary)' : 'transparent',
                        color: currentProject.id === project.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div>{project.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {project.environment} • {project.platform}
                          </div>
                        </div>
                        {currentProject.id === project.id && (
                          <Check className="w-4 h-4" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div
                  className="border-t py-1"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <button
                    onClick={() => {
                      setShowProjectMenu(false)
                      navigate(`/${currentOrg.slug}/projects`)
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    All Projects
                  </button>
                  <button
                    onClick={() => {
                      setShowProjectMenu(false)
                      navigate('/organizations')
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Building className="w-4 h-4" />
                    All Organizations
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Command palette trigger (placeholder) */}
        <button
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-primary)',
            color: 'var(--text-muted)',
          }}
          title="Search (Cmd+K)"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd
            className="ml-8 px-1.5 py-0.5 text-xs rounded"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
            }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center gap-2">
        {/* Critical alerts indicator */}
        {unreadCriticalCount > 0 && (
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--status-error)',
            }}
          >
            <AlertTriangle className="w-4 h-4" />
            {unreadCriticalCount} Critical
          </button>
        )}

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg transition-colors"
            style={{
              color: 'var(--text-secondary)',
            }}
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-medium rounded-full"
                style={{
                  backgroundColor: 'var(--status-error)',
                  color: 'white',
                }}
              >
                {notificationCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg border z-50"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Notifications
                </span>
                {unreadAlerts.length > 0 && (
                  <button
                    className="text-xs"
                    style={{ color: 'var(--accent-primary)' }}
                    onClick={() => setReadAlertIds(new Set(alerts.map((a) => a.id)))}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {unreadAlerts.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--status-success)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {alerts.length > 0 ? 'All alerts marked as read' : 'No active alerts'}
                    </p>
                  </div>
                ) : (
                  unreadAlerts.map((alert, index) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'px-4 py-3 transition-colors hover:bg-opacity-50',
                        index < unreadAlerts.length - 1 && 'border-b'
                      )}
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-2 h-2 mt-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              alert.severity === 'critical'
                                ? 'var(--status-error)'
                                : alert.severity === 'warning'
                                  ? 'var(--status-warning)'
                                  : 'var(--status-info)',
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {alert.message}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            {alert.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
        >
          {resolvedTheme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg transition-colors"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
              }}
            >
              <span className="text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <ChevronDown
              className={cn('w-4 h-4 transition-transform', showUserMenu && 'rotate-180')}
              style={{ color: 'var(--text-muted)' }}
            />
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg py-1 border z-50"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <div
                className="px-4 py-3 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {user?.name || 'User'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false)
                  navigate('/settings')
                }}
                className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(false)
                  handleLogout()
                }}
                className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2"
                style={{ color: 'var(--status-error)' }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
