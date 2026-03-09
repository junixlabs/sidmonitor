import { createContext, useContext, useState, ReactNode } from 'react'
import type { User, Organization, Project } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  currentOrg: Organization | null
  currentProject: Project | null
  organizations: Organization[]
  projects: Project[]
}

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void
  logout: () => void
  setCurrentOrg: (org: Organization | null) => void
  setCurrentProject: (project: Project | null) => void
  setOrganizations: (orgs: Organization[]) => void
  setProjects: (projects: Project[]) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    // Initialize from localStorage
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    const currentOrgStr = localStorage.getItem('currentOrg')
    const currentProjectStr = localStorage.getItem('currentProject')

    return {
      token,
      user: userStr ? JSON.parse(userStr) : null,
      currentOrg: currentOrgStr ? JSON.parse(currentOrgStr) : null,
      currentProject: currentProjectStr ? JSON.parse(currentProjectStr) : null,
      organizations: [],
      projects: [],
    }
  })

  const login = (token: string, user: User) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setState((prev) => ({ ...prev, token, user }))
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('currentOrg')
    localStorage.removeItem('currentProject')
    // Also remove legacy auth
    localStorage.removeItem('auth')
    setState({
      token: null,
      user: null,
      currentOrg: null,
      currentProject: null,
      organizations: [],
      projects: [],
    })
  }

  const setCurrentOrg = (org: Organization | null) => {
    if (org) {
      localStorage.setItem('currentOrg', JSON.stringify(org))
    } else {
      localStorage.removeItem('currentOrg')
    }
    setState((prev) => ({ ...prev, currentOrg: org, currentProject: null, projects: [] }))
    localStorage.removeItem('currentProject')
  }

  const setCurrentProject = (project: Project | null) => {
    if (project) {
      localStorage.setItem('currentProject', JSON.stringify(project))
    } else {
      localStorage.removeItem('currentProject')
    }
    setState((prev) => ({ ...prev, currentProject: project }))
  }

  const setOrganizations = (orgs: Organization[]) => {
    setState((prev) => ({ ...prev, organizations: orgs }))
  }

  const setProjects = (projects: Project[]) => {
    setState((prev) => ({ ...prev, projects }))
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        setCurrentOrg,
        setCurrentProject,
        setOrganizations,
        setProjects,
        isAuthenticated: !!state.token && !!state.user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
