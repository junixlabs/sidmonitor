import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orgApi } from '@/api/client'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { TabNav, Modal, SkeletonRows, EmptyState, Badge } from '@/components/ui'
import { formatDate } from '@/utils/format'
import { CACHE_CONFIG } from '@/utils/constants'
import {
  Building,
  Shield,
  ChevronRight,
  UserPlus,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'

type OrgTab = 'general' | 'members' | 'audit-log'

const tabs = [
  { key: 'general', label: 'General' },
  { key: 'members', label: 'Members' },
  { key: 'audit-log', label: 'Audit Log' },
]

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  member: 'bg-surface-tertiary text-text-muted',
}

const actionLabels: Record<string, string> = {
  'project.create': 'Created project',
  'project.delete': 'Deleted project',
  'api_key.create': 'Created API key',
  'api_key.revoke': 'Revoked API key',
  'api_key.rotate': 'Rotated API key',
  'member.invite': 'Invited member',
  'member.remove': 'Removed member',
  'member.role_change': 'Changed member role',
}

export default function OrgSettings() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const currentOrg = useWorkspaceStore((s) => s.currentOrg)
  const [activeTab, setActiveTab] = useState<OrgTab>('general')

  const slug = orgSlug || currentOrg?.slug || ''

  return (
    <div className="px-4 py-6 sm:px-0 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
        <Building className="w-4 h-4" />
        <span>{currentOrg?.name || slug}</span>
        <ChevronRight className="w-3 h-3" />
        <span>Settings</span>
      </div>
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Organization Settings</h1>

      <TabNav tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as OrgTab)} className="mb-6" />

      {activeTab === 'general' && <GeneralTab slug={slug} />}
      {activeTab === 'members' && <MembersTab slug={slug} />}
      {activeTab === 'audit-log' && <AuditLogTab slug={slug} />}
    </div>
  )
}

function GeneralTab({ slug }: { slug: string }) {
  const currentOrg = useWorkspaceStore((s) => s.currentOrg)
  const queryClient = useQueryClient()
  const [name, setName] = useState(currentOrg?.name || '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (currentOrg?.name) setName(currentOrg.name)
  }, [currentOrg?.name])

  const updateMutation = useMutation({
    mutationFn: (newName: string) => orgApi.update(slug, { name: newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="space-y-6">
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">General</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Organization Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full max-w-md pl-3 pr-3 py-2 text-sm border border-border-primary rounded-md bg-surface-secondary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Slug</label>
            <p className="text-sm text-text-muted font-mono">{slug}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Plan</label>
            <Badge className="bg-accent/10 text-accent">
              {currentOrg?.plan || 'Free'}
            </Badge>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Created</label>
            <p className="text-sm text-text-muted">
              {currentOrg?.created_at ? formatDate(currentOrg.created_at) : '—'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => updateMutation.mutate(name)}
              disabled={updateMutation.isPending || name === currentOrg?.name}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MembersTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [memberAction, setMemberAction] = useState<string | null>(null)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  // Close action menu on outside click
  useEffect(() => {
    if (!memberAction) return
    function handleClickOutside(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setMemberAction(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [memberAction])

  const { data: members, isLoading } = useQuery({
    queryKey: ['orgMembers', slug],
    queryFn: () => orgApi.listMembers(slug),
    enabled: !!slug,
    ...CACHE_CONFIG.standard,
  })

  const inviteMutation = useMutation({
    mutationFn: () => orgApi.inviteMember(slug, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('member')
      queryClient.invalidateQueries({ queryKey: ['orgMembers', slug] })
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'admin' | 'member' }) =>
      orgApi.updateMember(slug, memberId, { role }),
    onSuccess: () => {
      setMemberAction(null)
      queryClient.invalidateQueries({ queryKey: ['orgMembers', slug] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => orgApi.removeMember(slug, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgMembers', slug] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-text-primary">Members</h2>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center px-4 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          Invite Member
        </button>
      </div>

      <div className="bg-surface shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <SkeletonRows rows={3} className="space-y-3" />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border-subtle">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {members?.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-text-primary">{member.user_name}</div>
                    <div className="text-sm text-text-muted">{member.user_email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={roleColors[member.role] || roleColors.member}>
                      {member.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {member.role !== 'owner' && (
                      <div className="relative inline-block" ref={memberAction === member.id ? actionMenuRef : undefined}>
                        <button
                          onClick={() => setMemberAction(memberAction === member.id ? null : member.id)}
                          className="p-1 rounded hover:bg-surface-tertiary text-text-muted"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {memberAction === member.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-surface rounded-lg shadow-lg border border-border-primary z-10">
                            {member.role === 'member' && (
                              <button
                                onClick={() => updateRoleMutation.mutate({ memberId: member.id, role: 'admin' })}
                                className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-secondary"
                              >
                                Make Admin
                              </button>
                            )}
                            {member.role === 'admin' && (
                              <button
                                onClick={() => updateRoleMutation.mutate({ memberId: member.id, role: 'member' })}
                                className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-secondary"
                              >
                                Make Member
                              </button>
                            )}
                            <button
                              onClick={() => removeMutation.mutate(member.id)}
                              className="w-full text-left px-4 py-2 text-sm text-status-danger hover:bg-surface-secondary flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Member">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="block w-full pl-3 pr-3 py-2 text-sm border border-border-primary rounded-md bg-surface-secondary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              onKeyDown={(e) => e.key === 'Enter' && inviteMutation.mutate()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
              className="block w-full pl-3 pr-3 py-2 text-sm border border-border-primary rounded-md bg-surface-secondary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {inviteMutation.isError && (
            <p className="text-sm text-status-danger">
              {(inviteMutation.error as Error)?.message || 'Failed to invite member'}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowInviteModal(false)}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border-primary rounded-md hover:bg-surface-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent-hover disabled:opacity-50"
            >
              {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AuditLogTab({ slug }: { slug: string }) {
  const [page, setPage] = useState(1)
  const perPage = 25

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', slug, page],
    queryFn: () => orgApi.getAuditLogs(slug, page, perPage),
    enabled: !!slug,
    ...CACHE_CONFIG.standard,
  })

  const totalPages = data ? Math.ceil(data.total / perPage) : 0

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-text-primary">Audit Log</h2>

      <div className="bg-surface shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <SkeletonRows rows={5} />
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <table className="min-w-full divide-y divide-border-subtle">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Actor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">IP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-3 text-sm text-text-primary">
                      {actionLabels[entry.action] || entry.action}
                      {entry.target_type && (
                        <span className="text-text-muted ml-1">
                          ({entry.target_type})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary">
                      {entry.actor_name || entry.actor_email || entry.actor_type}
                    </td>
                    <td className="px-6 py-3 text-sm text-text-muted font-mono">
                      {entry.ip_address || '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-text-muted">
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border-subtle">
                <span className="text-sm text-text-muted">
                  Page {page} of {totalPages} ({data.total} entries)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-border-primary rounded-md text-text-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1 text-sm border border-border-primary rounded-md text-text-secondary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<Shield className="w-12 h-12" />}
            title="No audit log entries yet"
          />
        )}
      </div>
    </div>
  )
}
