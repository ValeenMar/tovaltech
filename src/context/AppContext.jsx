import { createContext, useContext, useState } from 'react'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // Filtro que Categories puede pasar a Products al navegar
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('')

  const value = {
    sidebarOpen, setSidebarOpen,
    adminCategoryFilter, setAdminCategoryFilter,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider')
  return context
}
