import { createContext, useContext, useEffect, useState } from 'react'

const AppContext = createContext()
const ADMIN_THEME_KEY = 'admin_theme'
const ADMIN_THEME_VALUES = ['violet', 'green', 'red']

function normalizeTheme(value) {
  return ADMIN_THEME_VALUES.includes(value) ? value : 'violet'
}

function readInitialTheme() {
  if (typeof window === 'undefined') return 'violet'
  try {
    return normalizeTheme(window.localStorage.getItem(ADMIN_THEME_KEY))
  } catch {
    return 'violet'
  }
}

export function AppProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [adminThemeState, setAdminThemeState] = useState(readInitialTheme)
  // Filtro que Categories puede pasar a Products al navegar
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(ADMIN_THEME_KEY, adminThemeState)
    } catch {
      // ignore write errors in private mode
    }
  }, [adminThemeState])

  const setAdminTheme = (theme) => setAdminThemeState(normalizeTheme(theme))
  const cycleAdminTheme = () => {
    setAdminThemeState((prev) => {
      const index = ADMIN_THEME_VALUES.indexOf(prev)
      const next = index === -1 ? 0 : (index + 1) % ADMIN_THEME_VALUES.length
      return ADMIN_THEME_VALUES[next]
    })
  }

  const value = {
    sidebarOpen, setSidebarOpen,
    adminTheme: adminThemeState,
    setAdminTheme,
    cycleAdminTheme,
    adminCategoryFilter, setAdminCategoryFilter,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider')
  return context
}
