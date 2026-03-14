import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  ChevronDown,
  Check,
  LayoutGrid,
  Building,
  Search,
} from 'lucide-react'

export default function ProjectSwitcher() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentOrg = useWorkspaceStore((s) => s.currentOrg)
  const currentProject = useWorkspaceStore((s) => s.currentProject)
  const projects = useWorkspaceStore((s) => s.projects)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search when opened
  useEffect(() => {
    if (open) {
      // Small delay to let the dropdown render
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open])

  // Keyboard shortcut: Ctrl+P to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.slug.toLowerCase().includes(search.toLowerCase())
      ),
    [projects, search]
  )

  const handleSelect = (project: typeof currentProject) => {
    if (!project || !currentOrg) return

    // Invalidate project-scoped cache to prevent stale data from previous project
    if (currentProject && currentProject.id !== project.id) {
      queryClient.removeQueries({
        predicate: (query) => {
          // Remove queries whose key contains the old project's ID
          const key = query.queryKey
          return Array.isArray(key) && key.some((k) => k === currentProject.id)
        },
      })
    }

    setOpen(false)
    setSearch('')
    navigate(`/${currentOrg.slug}/${project.slug}/dashboard`)
  }

  return (
    <div className="relative" ref={menuRef}>
      {currentOrg && currentProject ? (
        <button
          onClick={() => setOpen(!open)}
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
            className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
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
      ) : (
        <button
          onClick={() => navigate('/organizations')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
          }}
        >
          <Building className="w-4 h-4" />
          <span className="font-medium">Select Project</span>
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {open && (
        <div
          className="absolute left-0 mt-2 w-72 rounded-lg shadow-lg z-50 border"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          {/* Search input */}
          <div
            className="px-3 py-2 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false)
                    setSearch('')
                  }
                  if (e.key === 'Enter' && filtered.length === 1) {
                    handleSelect(filtered[0])
                  }
                }}
              />
            </div>
          </div>

          {/* Project list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div
                className="px-4 py-3 text-sm text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                No projects found
              </div>
            ) : (
              filtered.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors',
                    currentProject?.id === project.id && 'font-medium'
                  )}
                  style={{
                    backgroundColor:
                      currentProject?.id === project.id
                        ? 'var(--bg-tertiary)'
                        : 'transparent',
                    color:
                      currentProject?.id === project.id
                        ? 'var(--accent-primary)'
                        : 'var(--text-primary)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div>{project.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {project.environment} &bull; {project.platform}
                      </div>
                    </div>
                    {currentProject?.id === project.id && (
                      <Check className="w-4 h-4" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer actions */}
          <div
            className="border-t py-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <button
              onClick={() => {
                setOpen(false)
                setSearch('')
                navigate(currentOrg ? `/${currentOrg.slug}/projects` : '/organizations')
              }}
              className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <LayoutGrid className="w-4 h-4" />
              All Projects
            </button>
            <button
              onClick={() => {
                setOpen(false)
                setSearch('')
                navigate('/organizations')
              }}
              className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Building className="w-4 h-4" />
              All Organizations
            </button>
          </div>

          {/* Keyboard hint */}
          <div
            className="px-4 py-1.5 text-xs border-t flex items-center justify-between"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            <span>Switch project</span>
            <kbd
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              Ctrl+P
            </kbd>
          </div>
        </div>
      )}
    </div>
  )
}
