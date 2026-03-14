import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Key, Check, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { settingsApi, projectApi } from '../api/client'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { Modal, TabNav, SkeletonRows, EmptyState } from '@/components/ui'
import { formatDate } from '@/utils/format'
import { CACHE_CONFIG } from '@/utils/constants'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import type { ProjectApiKey } from '../types'

type SettingsTab = 'general' | 'sdk-setup' | 'api-keys'

const tabs = [
  { key: 'general', label: 'General' },
  { key: 'sdk-setup', label: 'SDK Setup' },
  { key: 'api-keys', label: 'API Keys' },
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Project Settings</h1>

      <TabNav tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as SettingsTab)} className="mb-6" />

      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'sdk-setup' && <SdkSetupTab />}
      {activeTab === 'api-keys' && <ApiKeysTab />}
    </div>
  )
}

function GeneralTab() {
  const navigate = useNavigate()
  const currentProject = useWorkspaceStore((s) => s.currentProject)
  const currentOrg = useWorkspaceStore((s) => s.currentOrg)
  const queryClient = useQueryClient()
  const projectSlug = currentProject?.slug

  const [name, setName] = useState(currentProject?.name || '')
  const [environment, setEnvironment] = useState(currentProject?.environment || 'production')
  const [saved, setSaved] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => {
    if (currentProject?.name) setName(currentProject.name)
    if (currentProject?.environment) setEnvironment(currentProject.environment)
  }, [currentProject?.name, currentProject?.environment])

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!projectSlug) throw new Error('No project selected')
      return projectApi.update(projectSlug, { name, environment })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectSettings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!projectSlug) throw new Error('No project selected')
      return projectApi.delete(projectSlug)
    },
    onSuccess: () => {
      setShowDeleteModal(false)
      navigate(currentOrg ? `/${currentOrg.slug}/projects` : '/organizations')
    },
  })

  const hasChanges = name !== currentProject?.name || environment !== currentProject?.environment

  return (
    <div className="space-y-6">
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Project Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full max-w-md pl-3 pr-3 py-2 text-sm border border-border-primary rounded-md bg-surface-secondary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Slug</label>
            <p className="text-sm text-text-muted font-mono">{currentProject?.slug}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Platform</label>
            <p className="text-sm text-text-muted">{currentProject?.platform}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="block w-full max-w-md pl-3 pr-3 py-2 text-sm border border-border-primary rounded-md bg-surface-secondary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Created</label>
            <p className="text-sm text-text-muted">
              {currentProject?.created_at ? formatDate(currentProject.created_at) : '—'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !hasChanges}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-surface shadow rounded-lg p-6 border border-status-danger/30">
        <h2 className="text-lg font-medium text-status-danger mb-2">Danger Zone</h2>
        <p className="text-sm text-text-muted mb-4">
          Deleting this project will permanently remove all associated data including logs, API keys, and configurations.
          This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-status-danger border border-status-danger/50 rounded-md hover:bg-status-danger/10"
        >
          <Trash2 className="w-4 h-4 mr-1.5" />
          Delete Project
        </button>
      </div>

      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
        title="Delete Project"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-status-danger/10 rounded-full">
              <AlertTriangle className="w-5 h-5 text-status-danger" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">This action is irreversible</p>
              <p className="text-sm text-text-muted">All project data will be permanently deleted.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Type <span className="font-mono font-bold">{currentProject?.name}</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={currentProject?.name}
              className="block w-full pl-3 pr-3 py-2 text-sm border border-border-primary rounded-md bg-surface-secondary text-text-primary focus:outline-none focus:ring-1 focus:ring-status-danger"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border-primary rounded-md hover:bg-surface-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteConfirm !== currentProject?.name || deleteMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-status-danger rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Project'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function SdkSetupTab() {
  const { copiedField, copy } = useCopyToClipboard()

  const { data: dsnInfo, isLoading: dsnLoading } = useQuery({
    queryKey: ['dsnInfo'],
    queryFn: () => settingsApi.getDSNInfo(),
    ...CACHE_CONFIG.stable,
  })

  return (
    <div className="space-y-6">
      {/* DSN Configuration */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">DSN Configuration</h2>
        <p className="text-sm text-text-secondary mb-4">
          Use the DSN (Data Source Name) to connect your Laravel application to this monitoring service.
        </p>
        {dsnLoading ? (
          <div className="h-12 bg-surface-tertiary animate-pulse rounded" />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">DSN Format</label>
              <div className="flex items-center">
                <code className="flex-1 block bg-surface-secondary px-4 py-3 rounded-l-md text-sm font-mono text-text-primary border border-border-primary">
                  {dsnInfo?.format}
                </code>
                <button
                  onClick={() => copy(dsnInfo?.format || '', 'format')}
                  className="px-4 py-3 bg-surface-tertiary hover:bg-surface-tertiary border border-l-0 border-border-primary rounded-r-md text-sm text-text-secondary"
                >
                  {copiedField === 'format' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Example DSN</label>
              <div className="flex items-center">
                <code className="flex-1 block bg-surface-secondary px-4 py-3 rounded-l-md text-sm font-mono text-text-primary border border-border-primary">
                  {dsnInfo?.example}
                </code>
                <button
                  onClick={() => copy(dsnInfo?.example || '', 'example')}
                  className="px-4 py-3 bg-surface-tertiary hover:bg-surface-tertiary border border-l-0 border-border-primary rounded-r-md text-sm text-text-secondary"
                >
                  {copiedField === 'example' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Installation Guide */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Laravel SDK Installation</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">1. Install the package</h3>
            <div className="flex items-center">
              <code className="flex-1 block bg-gray-900 text-green-400 px-4 py-3 rounded-l-md text-sm font-mono">
                composer require junixlabs/laravel-observatory
              </code>
              <button
                onClick={() => copy('composer require junixlabs/laravel-observatory', 'install')}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-r-md text-sm text-gray-200"
              >
                {copiedField === 'install' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">2. Publish configuration</h3>
            <div className="flex items-center">
              <code className="flex-1 block bg-gray-900 text-green-400 px-4 py-3 rounded-l-md text-sm font-mono">
                php artisan vendor:publish --tag=observatory-config
              </code>
              <button
                onClick={() => copy('php artisan vendor:publish --tag=observatory-config', 'publish')}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-r-md text-sm text-gray-200"
              >
                {copiedField === 'publish' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">3. Configure your .env file</h3>
            <div className="bg-gray-900 rounded-md p-4">
              <pre className="text-sm font-mono text-gray-300 overflow-x-auto">
{`# Enable Observatory monitoring
OBSERVATORY_ENABLED=true
OBSERVATORY_EXPORTER=sidmonitor

# SidMonitor backend endpoint
SIDMONITOR_ENDPOINT=http://your-sidmonitor-host:8000

# API Key (from Settings > API Keys)
SIDMONITOR_API_KEY=your-api-key-here`}
              </pre>
            </div>
            <button
              onClick={() => copy(`# Enable Observatory monitoring\nOBSERVATORY_ENABLED=true\nOBSERVATORY_EXPORTER=sidmonitor\n\n# SidMonitor backend endpoint\nSIDMONITOR_ENDPOINT=http://your-sidmonitor-host:8000\n\n# API Key (from Settings > API Keys)\nSIDMONITOR_API_KEY=your-api-key-here`, 'env')}
              className="mt-2 px-4 py-2 bg-surface-tertiary hover:bg-surface-tertiary rounded-md text-sm text-text-secondary"
            >
              {copiedField === 'env' ? 'Copied!' : 'Copy .env configuration'}
            </button>
          </div>

          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">4. Start monitoring</h3>
            <p className="text-sm text-text-secondary">
              Once configured, the package will automatically monitor inbound HTTP requests, outbound API calls (via Http facade),
              queue jobs, scheduled tasks, and exceptions. No additional code changes required.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-border-subtle">
            <p className="text-sm text-text-secondary">
              For detailed documentation including advanced configuration, service mapping, and troubleshooting,
              check the{' '}
              <a href="https://github.com/junixlabs/laravel-observatory" className="text-accent hover:text-accent-hover" target="_blank" rel="noopener noreferrer">
                Laravel Observatory documentation
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ApiKeysTab() {
  const { copiedField, copy } = useCopyToClipboard()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ProjectApiKey | null>(null)
  const [keyToRevoke, setKeyToRevoke] = useState<ProjectApiKey | null>(null)

  const queryClient = useQueryClient()
  const currentProject = useWorkspaceStore((s) => s.currentProject)
  const projectSlug = currentProject?.slug

  const { data: apiKeys, isLoading: keysLoading } = useQuery({
    queryKey: ['projectApiKeys', projectSlug],
    queryFn: () => projectSlug ? projectApi.listApiKeys(projectSlug) : Promise.resolve([]),
    enabled: !!projectSlug,
    ...CACHE_CONFIG.standard,
  })

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => {
      if (!projectSlug) throw new Error('No project selected')
      return projectApi.createApiKey(projectSlug, { name })
    },
    onSuccess: (data) => {
      setNewlyCreatedKey(data)
      setNewKeyName('')
      queryClient.invalidateQueries({ queryKey: ['projectApiKeys', projectSlug] })
    },
  })

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: string) => {
      if (!projectSlug) throw new Error('No project selected')
      return projectApi.revokeApiKey(projectSlug, keyId)
    },
    onSuccess: () => {
      setKeyToRevoke(null)
      queryClient.invalidateQueries({ queryKey: ['projectApiKeys', projectSlug] })
    },
  })

  const handleCreateKey = () => {
    if (newKeyName.trim()) {
      createKeyMutation.mutate(newKeyName.trim())
    }
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setNewKeyName('')
    setNewlyCreatedKey(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-text-primary">API Keys</h2>
          <p className="text-sm text-text-secondary mt-1">
            API keys authenticate requests from your application to the ingest endpoint.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover"
        >
          <Plus className="w-4 h-4 mr-1" />
          Create New Key
        </button>
      </div>

      <div className="bg-surface shadow rounded-lg overflow-hidden">
        {keysLoading ? (
          <div className="p-6">
            <SkeletonRows rows={2} />
          </div>
        ) : apiKeys && apiKeys.length > 0 ? (
          <table className="min-w-full divide-y divide-border-subtle">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Key Prefix</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border-subtle">
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{key.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted font-mono">{key.key_prefix}...</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{formatDate(key.created_at)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{key.last_used_at ? formatDate(key.last_used_at) : 'Never'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setKeyToRevoke(key)}
                      className="text-status-danger hover:text-status-danger/80"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon={<Key className="w-12 h-12" />}
            title="No API keys"
            description="Get started by creating a new API key."
            action={
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-accent hover:bg-accent-hover"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create API Key
              </button>
            }
          />
        )}
      </div>

      {/* Create API Key Modal */}
      <Modal
        open={showCreateModal}
        onClose={handleCloseCreateModal}
        title={newlyCreatedKey ? 'API Key Created' : 'Create New API Key'}
      >
        {newlyCreatedKey ? (
          <>
            <div>
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-status-success/10 rounded-full">
                <Check className="w-6 h-6 text-status-success" />
              </div>
              <div className="mt-3 text-center sm:mt-5">
                <p className="text-sm text-text-muted">
                  Your new API key has been created. Make sure to copy it now - you won't be able to see it again!
                </p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-text-secondary mb-1">API Key</label>
              <div className="flex items-center">
                <code className="flex-1 block bg-surface-secondary px-3 py-2 rounded-l-md text-sm font-mono text-text-primary border border-border-primary break-all">
                  {newlyCreatedKey.key || `${newlyCreatedKey.key_prefix}...`}
                </code>
                <button
                  onClick={() => copy(newlyCreatedKey.key || newlyCreatedKey.key_prefix, 'newKey')}
                  className="px-3 py-2 bg-surface-tertiary hover:bg-surface-tertiary border border-l-0 border-border-primary rounded-r-md text-sm text-text-secondary"
                >
                  {copiedField === 'newKey' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="mt-5 sm:mt-6">
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-accent border border-transparent rounded-md shadow-sm hover:bg-accent-hover sm:text-sm"
                onClick={handleCloseCreateModal}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              Give your API key a descriptive name to help you identify it later.
            </p>
            <div className="mt-4">
              <label htmlFor="keyName" className="block text-sm font-medium text-text-secondary">
                Key Name
              </label>
              <input
                type="text"
                name="keyName"
                id="keyName"
                className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-border-primary focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md border bg-surface-secondary text-text-primary"
                placeholder="e.g., Production Server"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
              />
            </div>
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-accent border border-transparent rounded-md shadow-sm hover:bg-accent-hover sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || createKeyMutation.isPending}
              >
                {createKeyMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-text-secondary bg-surface border border-border-primary rounded-md shadow-sm hover:bg-surface-secondary sm:mt-0 sm:col-start-1 sm:text-sm"
                onClick={handleCloseCreateModal}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={!!keyToRevoke}
        onClose={() => setKeyToRevoke(null)}
        title="Revoke API Key"
        size="sm"
      >
        <div className="sm:flex sm:items-start">
          <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-status-danger/10 rounded-full sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangle className="w-6 h-6 text-status-danger" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <p className="text-sm text-text-muted">
              Are you sure you want to revoke the API key "{keyToRevoke?.name}"? Any applications using this key will no longer be able to send logs.
            </p>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-status-danger border border-transparent rounded-md shadow-sm hover:opacity-90 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            onClick={() => keyToRevoke && revokeKeyMutation.mutate(keyToRevoke.id)}
            disabled={revokeKeyMutation.isPending}
          >
            {revokeKeyMutation.isPending ? 'Revoking...' : 'Revoke'}
          </button>
          <button
            type="button"
            className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-text-secondary bg-surface border border-border-primary rounded-md shadow-sm hover:bg-surface-secondary sm:mt-0 sm:w-auto sm:text-sm"
            onClick={() => setKeyToRevoke(null)}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  )
}
