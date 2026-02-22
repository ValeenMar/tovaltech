import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const navItems = [
  { key: 'dashboard', path: '/admin', icon: '◉', ultraIcon: '⬢', label: 'Dashboard', section: 'Principal' },
  { key: 'orders', path: '/admin/orders', icon: '◌', ultraIcon: '✶', label: 'Pedidos', section: 'Principal' },
  { key: 'products', path: '/admin/products', icon: '△', ultraIcon: '⬡', label: 'Productos', section: 'Principal' },
  { key: 'categories', path: '/admin/categories', icon: '◇', ultraIcon: '✧', label: 'Categorias', section: 'Principal' },
  { key: 'banners', path: '/admin/banners', icon: '▣', ultraIcon: '◈', label: 'Inicio', section: 'Principal' },
  { key: 'customers', path: '/admin/customers', icon: '◍', ultraIcon: '⎈', label: 'Clientes', section: 'Sistema' },
  { key: 'invoices', path: '/admin/invoices', icon: '▤', ultraIcon: '⌬', label: 'Facturas', section: 'Sistema' },
  { key: 'analytics', path: '/admin/analytics', icon: '▴', ultraIcon: '⬣', label: 'Analiticas', section: 'Sistema' },
  { key: 'settings', path: '/admin/settings', icon: '⚙', ultraIcon: '⛭', label: 'Configuracion', section: 'Sistema' },
];

function TovalTechLogo({ collapsed, ultraMode }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center shadow-lg shadow-black/20 flex-shrink-0 ${
        ultraMode
          ? 'bg-rose-500/15 ring-rose-300/45 shadow-[0_0_18px_rgba(255,74,102,0.45)] neon-blink'
          : 'bg-white/10 ring-white/20'
      }`}>
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="6" height="6" rx="1" />
          <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </div>

      {!collapsed && (
        <div>
          <p className="text-[17px] font-bold leading-none text-white tracking-tight">
            Toval<span className={ultraMode ? 'text-rose-300' : 'text-cyan-300'}>Tech</span>
          </p>
          <p className="text-[10px] tracking-[0.18em] uppercase text-white/45 mt-1">Admin Control</p>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen, ultraMode } = useApp();
  const sections = [...new Set(navItems.map((item) => item.section))];

  const isActive = (item) => {
    if (item.path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(item.path);
  };

  const handleNav = (item) => {
    navigate(item.path);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          admin-sidebar fixed lg:static inset-y-0 left-0 z-50
          w-[280px] lg:w-[272px] text-white
          flex flex-col transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-[86px]'}
        `}
      >
        <div className="px-4 pt-5 pb-4 border-b border-white/10 shrink-0">
          <TovalTechLogo collapsed={!sidebarOpen} ultraMode={ultraMode} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section} className="mb-4 last:mb-0">
              <div
                className={`px-2 mb-2 text-[10px] uppercase tracking-[0.2em] text-white/35
                  ${!sidebarOpen ? 'lg:text-center lg:px-0' : ''}`}
              >
                {section}
              </div>

              <div className="space-y-1">
                {navItems.filter((item) => item.section === section).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNav(item)}
                    className={`sidebar-item w-full ${isActive(item) ? 'active' : ''} ${
                      !sidebarOpen ? 'lg:justify-center lg:px-0' : ''
                    }`}
                  >
                    <span className="w-6 h-6 rounded-lg bg-white/10 ring-1 ring-white/15 flex items-center justify-center text-[12px] font-bold">
                      {ultraMode ? item.ultraIcon : item.icon}
                    </span>
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 px-3 pb-3">
          <a
            href="/productos"
            target="_blank"
            rel="noopener noreferrer"
            title="Ver tienda"
            className={`flex items-center gap-3 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium
              text-white/75 hover:text-white hover:bg-white/10 transition-all duration-200 ${
              !sidebarOpen ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <span className="w-6 h-6 rounded-lg bg-white/10 ring-1 ring-white/15 flex items-center justify-center text-[12px] font-bold">
              {ultraMode ? '⬢' : '△'}
            </span>
            {sidebarOpen && <span className="flex-1">Ver tienda</span>}
          </a>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Ver inicio"
            className={`mt-2 flex items-center gap-3 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium
              text-white/75 hover:text-white hover:bg-white/10 transition-all duration-200 ${
                !sidebarOpen ? 'lg:justify-center lg:px-0' : ''
              }`}
          >
            <span className="w-6 h-6 rounded-lg bg-white/10 ring-1 ring-white/15 flex items-center justify-center text-[12px] font-bold">
              {ultraMode ? '✶' : '◉'}
            </span>
            {sidebarOpen && <span className="flex-1">Ver inicio</span>}
          </a>
        </div>
      </aside>
    </>
  );
}
