/** Application-wide constants */

// -- Pagination --
export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [20, 50, 100]

// -- Filter Options --
export const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: '2xx', label: '2xx Success' },
  { value: '4xx', label: '4xx Client Error' },
  { value: '5xx', label: '5xx Server Error' },
]

export const METHOD_OPTIONS = [
  { value: '', label: 'All Methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
]

export const TIME_RANGES = {
  dashboard: ['1h', '6h', '24h', '7d'] as const,
  global: ['24h', '7d', '30d'] as const,
}

// -- React Query Cache Presets --
export const CACHE_CONFIG = {
  standard: { staleTime: 25_000, gcTime: 10 * 60_000, refetchInterval: 30_000 },
  analytics: { staleTime: 55_000, gcTime: 15 * 60_000, refetchInterval: 60_000 },
  stable: { staleTime: 5 * 60_000, gcTime: 30 * 60_000 },
}

// -- localStorage Keys --
export const STORAGE = {
  TOKEN: 'token',
  USER: 'user',
  CURRENT_ORG: 'currentOrg',
  CURRENT_PROJECT: 'currentProject',
  THEME_MODE: 'sidmonitor-theme-mode',
  THEME_DENSITY: 'sidmonitor-theme-density',
  SIDEBAR_COLLAPSED: 'sidebarCollapsed',
} as const
