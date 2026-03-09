import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Key, Check, AlertTriangle, Plus } from 'lucide-react'
import { settingsApi, projectApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { Modal } from '@/components/ui'
import type { ProjectApiKey } from '../types'

export default function Settings() {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ProjectApiKey | null>(null)
  const [keyToRevoke, setKeyToRevoke] = useState<ProjectApiKey | null>(null)

  const queryClient = useQueryClient()
  const { currentProject } = useAuth()
  const projectSlug = currentProject?.slug

  const { data: projectSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['projectSettings'],
    queryFn: () => settingsApi.getProjectSettings(),
  })

  const { data: dsnInfo, isLoading: dsnLoading } = useQuery({
    queryKey: ['dsnInfo'],
    queryFn: () => settingsApi.getDSNInfo(),
  })

  // Use project-based API keys
  const { data: apiKeys, isLoading: keysLoading } = useQuery({
    queryKey: ['projectApiKeys', projectSlug],
    queryFn: () => projectSlug ? projectApi.listApiKeys(projectSlug) : Promise.resolve([]),
    enabled: !!projectSlug,
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
      queryClient.invalidateQueries({ queryKey: ['projectSettings'] })
      queryClient.invalidateQueries({ queryKey: ['dsnInfo'] })
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
      queryClient.invalidateQueries({ queryKey: ['projectSettings'] })
      queryClient.invalidateQueries({ queryKey: ['dsnInfo'] })
    },
  })

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const isLoading = settingsLoading || dsnLoading

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Project Configuration */}
        <div className="bg-surface shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Project Configuration</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-6 bg-surface-tertiary animate-pulse rounded w-3/4" />
              ))}
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-text-muted">Project Name</dt>
                <dd className="mt-1 text-sm text-text-primary">{projectSettings?.project_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-text-muted">API Keys Configured</dt>
                <dd className="mt-1 text-sm text-text-primary">
                  {projectSettings?.api_key_count || 0} key(s)
                  {projectSettings?.api_key_preview && (
                    <span className="ml-2 text-text-muted font-mono text-xs">
                      ({projectSettings.api_key_preview})
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-text-muted">Ingest Endpoint</dt>
                <dd className="mt-1 text-sm text-text-primary font-mono">
                  {projectSettings?.dsn_endpoint}
                </dd>
              </div>
            </dl>
          )}
        </div>

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
                    onClick={() => copyToClipboard(dsnInfo?.format || '', 'format')}
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
                    onClick={() => copyToClipboard(dsnInfo?.example || '', 'example')}
                    className="px-4 py-3 bg-surface-tertiary hover:bg-surface-tertiary border border-l-0 border-border-primary rounded-r-md text-sm text-text-secondary"
                  >
                    {copiedField === 'example' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* API Keys Management */}
        <div className="bg-surface shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">API Keys</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create New Key
            </button>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            API keys are used to authenticate requests from your Laravel application to the ingest endpoint.
          </p>

          {keysLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-tertiary animate-pulse rounded" />
              ))}
            </div>
          ) : apiKeys && apiKeys.length > 0 ? (
            <div className="overflow-hidden border border-border-subtle rounded-lg">
              <table className="min-w-full divide-y divide-border-subtle">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      Key Prefix
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      Last Used
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border-subtle">
                  {apiKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                        {key.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted font-mono">
                        {key.key_prefix}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                        {formatDate(key.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                        {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                      </td>
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
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-border-primary rounded-lg">
              <Key className="mx-auto h-12 w-12 text-text-muted" />
              <h3 className="mt-2 text-sm font-medium text-text-primary">No API keys</h3>
              <p className="mt-1 text-sm text-text-muted">Get started by creating a new API key.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-accent hover:bg-accent-hover"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create API Key
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Installation Guide */}
        <div className="bg-surface shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Laravel SDK Installation</h2>
          <div className="space-y-6">
            {/* Step 1 */}
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-2">1. Install the package</h3>
              <div className="flex items-center">
                <code className="flex-1 block bg-gray-900 text-green-400 px-4 py-3 rounded-l-md text-sm font-mono">
                  composer require sid-stack/monitoring-laravel
                </code>
                <button
                  onClick={() => copyToClipboard('composer require sid-stack/monitoring-laravel', 'install')}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-r-md text-sm text-gray-200"
                >
                  {copiedField === 'install' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-2">2. Publish configuration</h3>
              <div className="flex items-center">
                <code className="flex-1 block bg-gray-900 text-green-400 px-4 py-3 rounded-l-md text-sm font-mono">
                  php artisan vendor:publish --tag=sid-monitoring-config
                </code>
                <button
                  onClick={() => copyToClipboard('php artisan vendor:publish --tag=sid-monitoring-config', 'publish')}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-r-md text-sm text-gray-200"
                >
                  {copiedField === 'publish' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-2">3. Configure your .env file</h3>
              <div className="bg-gray-900 rounded-md p-4">
                <pre className="text-sm font-mono text-gray-300 overflow-x-auto">
{`# Enable SidStack Monitoring
SID_MONITORING_ENABLED=true

# Your DSN (Data Source Name)
SID_MONITORING_DSN=${dsnInfo?.example || 'https://your-api-key@host/api/ingest'}

# Optional: Use queue for better performance
SID_MONITORING_TRANSPORT=queue`}
                </pre>
              </div>
              <button
                onClick={() => copyToClipboard(`# Enable SidStack Monitoring\nSID_MONITORING_ENABLED=true\n\n# Your DSN (Data Source Name)\nSID_MONITORING_DSN=${dsnInfo?.example || 'https://your-api-key@host/api/ingest'}\n\n# Optional: Use queue for better performance\nSID_MONITORING_TRANSPORT=queue`, 'env')}
                className="mt-2 px-4 py-2 bg-surface-tertiary hover:bg-surface-tertiary rounded-md text-sm text-text-secondary"
              >
                {copiedField === 'env' ? 'Copied!' : 'Copy .env configuration'}
              </button>
            </div>

            {/* Step 4 */}
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-2">4. Start monitoring</h3>
              <p className="text-sm text-text-secondary">
                Once configured, the package will automatically monitor all inbound HTTP requests to your Laravel application.
                Outbound requests can be monitored by adding the Guzzle middleware to your HTTP clients.
              </p>
            </div>

            {/* Documentation Link */}
            <div className="mt-6 pt-4 border-t border-border-subtle">
              <p className="text-sm text-text-secondary">
                For detailed documentation including outbound monitoring, custom configurations, and troubleshooting,
                check the{' '}
                <a href="https://github.com/sid-stack/monitoring-laravel" className="text-accent hover:text-accent-hover" target="_blank" rel="noopener noreferrer">
                  Laravel SDK documentation
                </a>.
              </p>
            </div>
          </div>
        </div>
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
                  onClick={() => copyToClipboard(newlyCreatedKey.key || newlyCreatedKey.key_prefix, 'newKey')}
                  className="px-3 py-2 bg-surface-tertiary hover:bg-surface-tertiary border border-l-0 border-border-primary rounded-r-md text-sm text-text-secondary"
                >
                  {copiedField === 'newKey' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="mt-5 sm:mt-6">
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-accent border border-transparent rounded-md shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent sm:text-sm"
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
                className="block w-full mt-1 border-border-primary rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
                placeholder="e.g., Production Server"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
              />
            </div>
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-accent border border-transparent rounded-md shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || createKeyMutation.isPending}
              >
                {createKeyMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-text-secondary bg-surface border border-border-primary rounded-md shadow-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent sm:mt-0 sm:col-start-1 sm:text-sm"
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
            className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-status-danger border border-transparent rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-status-danger sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            onClick={() => keyToRevoke && revokeKeyMutation.mutate(keyToRevoke.id)}
            disabled={revokeKeyMutation.isPending}
          >
            {revokeKeyMutation.isPending ? 'Revoking...' : 'Revoke'}
          </button>
          <button
            type="button"
            className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-text-secondary bg-surface border border-border-primary rounded-md shadow-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent sm:mt-0 sm:w-auto sm:text-sm"
            onClick={() => setKeyToRevoke(null)}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  )
}
