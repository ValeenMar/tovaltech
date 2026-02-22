import { createContext, useContext, useEffect, useState } from 'react'

const AppContext = createContext()
const ULTRA_MODE_KEY = 'admin_ultra_mode'

function readInitialUltraMode() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ULTRA_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [ultraMode, setUltraMode] = useState(readInitialUltraMode)
  // Filtro que Categories puede pasar a Products al navegar
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(ULTRA_MODE_KEY, ultraMode ? '1' : '0')
    } catch {
      // ignore write errors in private mode
    }
  }, [ultraMode])

  const toggleUltraMode = () => setUltraMode(prev => !prev)

  const value = {
    sidebarOpen, setSidebarOpen,
    ultraMode, setUltraMode, toggleUltraMode,
    adminCategoryFilter, setAdminCategoryFilter,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider')
  return context
}
