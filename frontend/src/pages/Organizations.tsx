import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { orgApi, projectApi } from '../api/client'
import { Modal, ErrorAlert } from '@/components/ui'
import type { Organization } from '../types'

export default function Organizations() {
  const navigate = useNavigate()
  const { user, setCurrentOrg, setCurrentProject, setOrganizations, setProjects } = useAuth()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadOrganizations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      const data = await orgApi.list()
      setOrgs(data)
      setOrganizations(data)
    } catch {
      setError('Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOrg = async (org: Organization) => {
    try {
      setCurrentOrg(org)
      // Load projects for this org
      const projects = await projectApi.list(org.slug)
      setProjects(projects)

      if (projects.length === 1) {
        // Auto-select if only one project
        setCurrentProject(projects[0])
        navigate('/')
      } else if (projects.length === 0) {
        // Redirect to create project
        navigate(`/${org.slug}/projects/new`)
      } else {
        // Show project selection
        navigate(`/${org.slug}/projects`)
      }
    } catch (err) {
      setError('Failed to load projects')
    }
  }

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return

    try {
      setCreating(true)
      const newOrg = await orgApi.create(newOrgName)
      setOrgs([...orgs, newOrg])
      setShowCreateModal(false)
      setNewOrgName('')
      handleSelectOrg(newOrg)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      setError(axiosError.response?.data?.detail || 'Failed to create organization')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-text-muted">Loading...</div>
      </div>
    )
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Organizations</h1>
            <p className="mt-1 text-sm text-text-muted">
              Welcome, {user?.name}. Select an organization to continue.
            </p>
          </div>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} className="mb-4" />}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSelectOrg(org)}
              className="p-6 bg-surface rounded-lg shadow hover:shadow-md transition-shadow text-left"
            >
              <h3 className="text-lg font-medium text-text-primary">{org.name}</h3>
              <p className="mt-1 text-sm text-text-muted">{org.slug}</p>
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                  {org.plan}
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
                <span className="mt-2 block text-sm font-medium text-text-primary">Create Organization</span>
              </div>
            </div>
          </button>
        </div>

        {/* Create Organization Modal */}
        <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setNewOrgName('') }} title="Create Organization" size="sm">
          <input
            type="text"
            placeholder="Organization name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-accent focus:border-accent"
            autoFocus
          />
          <div className="mt-4 flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowCreateModal(false)
                setNewOrgName('')
              }}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateOrg}
              disabled={creating || !newOrgName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </Modal>
    </div>
  )
}
