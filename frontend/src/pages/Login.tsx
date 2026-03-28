import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { authApi, orgApi, projectApi } from '../api/client'
import { Activity, Eye, EyeOff, Loader2, AlertCircle, Mail, Lock } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authApi.login({ email, password })
      login(response.access_token, response.user)

      // Smart redirect: restore last project or auto-select first one
      const { currentOrg, currentProject } = useWorkspaceStore.getState()
      if (currentOrg && currentProject) {
        navigate(`/${currentOrg.slug}/${currentProject.slug}/dashboard`)
      } else {
        try {
          const orgs = await orgApi.list()
          if (orgs.length > 0) {
            const org = orgs[0]
            const projects = await projectApi.list(org.slug)
            if (projects.length > 0) {
              useWorkspaceStore.getState().setCurrentOrg(org)
              useWorkspaceStore.getState().switchProject(projects[0])
              useWorkspaceStore.getState().setProjects(projects)
              navigate(`/${org.slug}/${projects[0].slug}/dashboard`)
            } else {
              useWorkspaceStore.getState().setCurrentOrg(org)
              navigate(`/${org.slug}/projects/new`)
            }
          } else {
            navigate('/organizations')
          }
        } catch {
          navigate('/')
        }
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { detail?: string } } }
      if (axiosError.response?.status === 401) {
        setError('Invalid email or password')
      } else if (axiosError.response?.data?.detail) {
        setError(axiosError.response.data.detail)
      } else {
        setError('An error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--text-muted) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
        <div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, var(--accent-primary), transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, var(--accent-primary), transparent 70%)' }}
        />
      </div>

      <div className="max-w-[420px] w-full relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 mb-4">
            <Activity className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            SidMonitor
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Sign in to monitor your applications
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-border-primary p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-10 pr-4 py-2.5 text-sm bg-surface-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 pr-10 py-2.5 text-sm bg-surface-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-status-danger/8 border border-status-danger/20 px-3.5 py-3">
                <AlertCircle className="w-4 h-4 text-status-danger shrink-0 mt-0.5" />
                <p className="text-sm text-status-danger">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg text-white bg-accent hover:bg-accent-hover transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-accent hover:text-accent-hover transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
