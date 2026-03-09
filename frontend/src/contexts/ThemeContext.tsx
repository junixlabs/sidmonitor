import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'
type DensityMode = 'compact' | 'comfortable'

interface ThemeState {
  mode: ThemeMode
  density: DensityMode
  resolvedTheme: 'light' | 'dark'
}

interface ThemeContextType extends ThemeState {
  setMode: (mode: ThemeMode) => void
  setDensity: (density: DensityMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY_MODE = 'sidmonitor-theme-mode'
const STORAGE_KEY_DENSITY = 'sidmonitor-theme-density'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(() => {
    const storedMode = localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode | null
    const storedDensity = localStorage.getItem(STORAGE_KEY_DENSITY) as DensityMode | null

    const mode = storedMode || 'system'
    const density = storedDensity || 'comfortable'

    return {
      mode,
      density,
      resolvedTheme: resolveTheme(mode),
    }
  })

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement

    // Remove existing theme classes
    root.classList.remove('light', 'dark')

    // Add resolved theme class
    root.classList.add(state.resolvedTheme)

    // Also add density class
    root.classList.remove('density-compact', 'density-comfortable')
    root.classList.add(`density-${state.density}`)
  }, [state.resolvedTheme, state.density])

  // Listen for system theme changes
  useEffect(() => {
    if (state.mode !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      setState((prev) => ({
        ...prev,
        resolvedTheme: e.matches ? 'dark' : 'light',
      }))
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [state.mode])

  const setMode = (mode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY_MODE, mode)
    setState((prev) => ({
      ...prev,
      mode,
      resolvedTheme: resolveTheme(mode),
    }))
  }

  const setDensity = (density: DensityMode) => {
    localStorage.setItem(STORAGE_KEY_DENSITY, density)
    setState((prev) => ({
      ...prev,
      density,
    }))
  }

  const toggleTheme = () => {
    const newMode = state.resolvedTheme === 'light' ? 'dark' : 'light'
    setMode(newMode)
  }

  return (
    <ThemeContext.Provider
      value={{
        ...state,
        setMode,
        setDensity,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
