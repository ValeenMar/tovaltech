import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

const navItems = [
  { key: 'dashboard',  path: '/admin',            icon: '📊', label: 'Dashboard',      section: 'Principal' },
  { key: 'orders',     path: '/admin/orders',      icon: '📦', label: 'Pedidos',        badge: 12, section: 'Principal' },
  { key: 'products',   path: '/admin/products',    icon: '🏷️', label: 'Productos',      section: 'Principal' },
  { key: 'categories', path: '/admin/categories',  icon: '🗂️', label: 'Categorías',     section: 'Principal' },
  { key: 'banners',    path: '/admin/banners',      icon: '🖼️', label: 'Inicio',         section: 'Principal' },
  { key: 'customers',  path: '/admin/customers',   icon: '👥', label: 'Clientes',       section: 'Principal' },
  { key: 'invoices',   path: '/admin/invoices',    icon: '🧾', label: 'Facturas',       section: 'Sistema' },
  { key: 'analytics',  path: '/admin/analytics',   icon: '📈', label: 'Analíticas',     section: 'Sistema' },
  { key: 'settings',   path: '/admin/settings',    icon: '⚙️', label: 'Configuración',  section: 'Sistema' },
]

export default function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { sidebarOpen, setSidebarOpen } = useApp()
  const sections  = [...new Set(navItems.map(i => i.section))]

  // Determina si un item está activo:
  // - /admin (index) → activo solo si pathname === '/admin' exacto
  // - resto → activo si pathname empieza con el path del item
  const isActive = (item) => {
    if (item.path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(item.path)
  }

  const handleNav = (item) => {
    navigate(item.path)
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  return (
    <>
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gradient-to-b from-sidebar to-sidebar-light text-white
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'}
      `}>
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-3 border-b border-white/10 shrink-0">
          <span className="text-2xl">⚡</span>
          {sidebarOpen && <h1 className="text-lg font-bold tracking-tight">AzurePanel</h1>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {sections.map(section => (
            <div key={section}>
              <div className={`px-5 py-2 text-[10px] uppercase tracking-widest text-white/40
                ${!sidebarOpen && 'lg:text-center lg:px-1 lg:text-[8px]'}`}>
                {section}
              </div>
              {navItems.filter(i => i.section === section).map(item => (
                <div
                  key={item.key}
                  onClick={() => handleNav(item)}
                  className={`sidebar-item ${isActive(item) ? 'active' : ''} ${!sidebarOpen ? 'lg:justify-center lg:px-0' : ''}`}
                >
                  <span className="text-lg min-w-[24px] text-center">{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                  {sidebarOpen && item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Botón Ver Tienda ── */}
        <div className="shrink-0 px-3 py-4 border-t border-white/10">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Ver tienda"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200
              ${!sidebarOpen ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <span className="text-lg min-w-[24px] text-center">🛒</span>
            {sidebarOpen && <span className="flex-1">Ver tienda</span>}
            {sidebarOpen && <span className="text-white/40 text-xs">↗</span>}
          </a>
        </div>
      </aside>
    </>
  )
}
