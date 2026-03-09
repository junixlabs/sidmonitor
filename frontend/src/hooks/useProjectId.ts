import { useAuth } from '@/contexts/AuthContext'

export function useProjectId(): string | undefined {
  const { currentProject } = useAuth()
  return currentProject?.id
}
