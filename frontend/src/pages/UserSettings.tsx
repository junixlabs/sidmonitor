import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { authApi } from '@/api/client'
import { TabNav } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/format'
import { User, Palette, Check } from 'lucide-react'

type UserTab = 'profile' | 'appearance'

const tabs = [
  { key: 'profile', label: 'Profile' },
  { key: 'appearance', label: 'Appearance' },
]

export default function UserSettings() {
  const [activeTab, setActiveTab] = useState<UserTab>('profile')

  return (
    <div className="px-4 py-6 sm:px-0 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">User Settings</h1>

      <TabNav tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as UserTab)} className="mb-6" />

      {activeTab === 'profile' && <ProfileSection />}
      {activeTab === 'appearance' && <AppearanceSection />}
    </div>
  )
}

function ProfileSection() {
  const { user, login } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user?.name) setName(user.name)
  }, [user?.name])

  const updateMutation = useMutation({
    mutationFn: (newName: string) => authApi.updateMe({ name: newName }),
    onSuccess: (updatedUser) => {
      const token = localStorage.getItem('token')
      if (token) {
        login(token, updatedUser)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="space-y-6">
      <div className="bg-surface shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-text-muted" />
          <h2 className="text-lg font-medium text-text-primary">Profile</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Avatar</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
                <span className="text-2xl font-medium text-white">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full max-w-md pl-3 pr-3 py-2 text-sm border border-border-primary rounded-md bg-surface-secondary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <p className="text-sm text-text-muted">{user?.email}</p>
            <p className="text-xs text-text-muted mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Member Since</label>
            <p className="text-sm text-text-muted">
              {user?.created_at ? formatDate(user.created_at) : '—'}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => updateMutation.mutate(name)}
              disabled={updateMutation.isPending || name === user?.name}
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

const themeOptions = [
  { value: 'light' as const, label: 'Light', description: 'Light background with dark text' },
  { value: 'dark' as const, label: 'Dark', description: 'Dark background with light text' },
  { value: 'system' as const, label: 'System', description: 'Follows your operating system preference' },
]

const densityOptions = [
  { value: 'comfortable' as const, label: 'Comfortable', description: 'More spacing for easier reading' },
  { value: 'compact' as const, label: 'Compact', description: 'Denser layout to show more content' },
]

function AppearanceSection() {
  const { mode, density, setMode, setDensity } = useTheme()

  return (
    <div className="space-y-6">
      <div className="bg-surface shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="w-5 h-5 text-text-muted" />
          <h2 className="text-lg font-medium text-text-primary">Appearance</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">Theme</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  className={cn(
                    'relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors',
                    mode === option.value
                      ? 'border-accent bg-accent/5'
                      : 'border-border-primary hover:border-border-primary/80 bg-surface-secondary'
                  )}
                >
                  {mode === option.value && (
                    <Check className="absolute top-3 right-3 w-4 h-4 text-accent" />
                  )}
                  <span className="text-sm font-medium text-text-primary">{option.label}</span>
                  <span className="text-xs text-text-muted mt-1">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">Density</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {densityOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDensity(option.value)}
                  className={cn(
                    'relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors',
                    density === option.value
                      ? 'border-accent bg-accent/5'
                      : 'border-border-primary hover:border-border-primary/80 bg-surface-secondary'
                  )}
                >
                  {density === option.value && (
                    <Check className="absolute top-3 right-3 w-4 h-4 text-accent" />
                  )}
                  <span className="text-sm font-medium text-text-primary">{option.label}</span>
                  <span className="text-xs text-text-muted mt-1">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
