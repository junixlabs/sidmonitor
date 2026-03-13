import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { projectApi, orgApi } from '../api/client'
import { Modal, ErrorAlert } from '@/components/ui'
import type { Project } from '../types'

export default function Projects() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const navigate = useNavigate()
  const currentOrg = useWorkspaceStore((s) => s.currentOrg)
  const setCurrentOrg = useWorkspaceStore((s) => s.setCurrentOrg)
  const switchProject = useWorkspaceStore((s) => s.switchProject)
  const projects = useWorkspaceStore((s) => s.projects)
  const setProjects = useWorkspaceStore((s) => s.setProjects)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPlatform, setNewProjectPlatform] = useState('laravel')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug])

  const loadProjects = async () => {
    if (!orgSlug) return

    try {
      setLoading(true)

      // Load org if not set
      if (!currentOrg || currentOrg.slug !== orgSlug) {
        const org = await orgApi.get(orgSlug)
        setCurrentOrg(org)
      }

      const data = await projectApi.list(orgSlug)
      setProjects(data)
    } catch {
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectProject = (project: Project) => {
    switchProject(project)
    const slug = currentOrg?.slug || orgSlug
    navigate(`/${slug}/${project.slug}/dashboard`)
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !orgSlug) return

    try {
      setCreating(true)
      const newProject = await projectApi.create(orgSlug, {
        name: newProjectName,
        platform: newProjectPlatform,
        environment: 'development',
      })
      setProjects([...projects, newProject])
      setShowCreateModal(false)
      setNewProjectName('')
      handleSelectProject(newProject)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      setError(axiosError.response?.data?.detail || 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-tertiary flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-tertiary">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <button
              onClick={() => navigate('/organizations')}
              className="text-sm text-accent hover:text-accent mb-2"
            >
              &larr; Back to Organizations
            </button>
            <h1 className="text-3xl font-bold text-text-primary">Projects</h1>
            <p className="mt-1 text-sm text-text-muted">
              {currentOrg?.name} - Select a project to view logs
            </p>
          </div>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} className="mb-4" />}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleSelectProject(project)}
              className="p-6 bg-surface rounded-lg shadow hover:shadow-md transition-shadow text-left"
            >
              <h3 className="text-lg font-medium text-text-primary">{project.name}</h3>
              <p className="mt-1 text-sm text-text-muted">{project.slug}</p>
              <div className="mt-2 flex space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-info/10 text-status-info">
                  {project.platform}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-success/10 text-status-success">
                  {project.environment}
                </span>
              </div>
            </button>
          ))}

          <button
            onClick={() => setShowCreateModal(true)}
            className="p-6 bg-surface rounded-lg shadow hover:shadow-md transition-shadow text-left border-2 border-dashed border-border-primary hover:border-indigo-500"
          >
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="mt-2 block text-sm font-medium text-text-primary">Create Project</span>
              </div>
            </div>
          </button>
        </div>

        {/* Create Project Modal */}
        <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setNewProjectName('') }} title="Create Project" size="sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-text-secondary">
                Project Name
              </label>
              <input
                id="projectName"
                type="text"
                placeholder="My Laravel App"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-accent focus:border-accent"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="platform" className="block text-sm font-medium text-text-secondary">
                Platform
              </label>
              <select
                id="platform"
                value={newProjectPlatform}
                onChange={(e) => setNewProjectPlatform(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-accent focus:border-accent"
              >
                <option value="laravel">Laravel</option>
                <option value="nodejs">Node.js</option>
                <option value="python">Python</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowCreateModal(false)
                setNewProjectName('')
              }}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              disabled={creating || !newProjectName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </Modal>
      </div>
    </div>
  )
}
