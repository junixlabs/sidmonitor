import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Organization, Project } from '../types'

interface WorkspaceState {
  currentOrg: Organization | null
  currentProject: Project | null
  organizations: Organization[]
  projects: Project[]
  isReady: boolean
}

interface WorkspaceActions {
  setCurrentOrg: (org: Organization | null) => void
  switchProject: (project: Project | null) => void
  setOrganizations: (orgs: Organization[]) => void
  setProjects: (projects: Project[]) => void
  setReady: (ready: boolean) => void
  reset: () => void
}

const initialState: WorkspaceState = {
  currentOrg: null,
  currentProject: null,
  organizations: [],
  projects: [],
  isReady: false,
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  persist(
    (set) => ({
      ...initialState,

      setCurrentOrg: (org) =>
        set({ currentOrg: org, currentProject: null, projects: [] }),

      switchProject: (project) =>
        set({ currentProject: project }),

      setOrganizations: (orgs) =>
        set({ organizations: orgs }),

      setProjects: (projects) =>
        set({ projects }),

      setReady: (ready) =>
        set({ isReady: ready }),

      reset: () => set(initialState),
    }),
    {
      name: 'sidmonitor-workspace',
      partialize: (state) => ({
        currentOrg: state.currentOrg,
        currentProject: state.currentProject,
      }),
    }
  )
)
