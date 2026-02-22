import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const pageTitles = {
  '/admin': 'Dashboard',
  '/admin/orders': 'Pedidos',
  '/admin/products': 'Productos',
  '/admin/categories': 'Categorias',
  '/admin/banners': 'Inicio',
  '/admin/customers': 'Clientes',
  '/admin/invoices': 'Facturas',
  '/admin/analytics': 'Analiticas',
  '/admin/settings': 'Configuracion',
};

const commands = [
  { path: '/admin', icon: '◉', label: 'Ir a Dashboard', keywords: 'panel inicio resumen' },
  { path: '/admin/orders', icon: '◌', label: 'Abrir Pedidos', keywords: 'ventas ordenes pagos' },
  { path: '/admin/products', icon: '△', label: 'Abrir Productos', keywords: 'catalogo precios stock' },
  { path: '/admin/categories', icon: '◇', label: 'Abrir Categorias', keywords: 'rubro subcategoria markup' },
  { path: '/admin/banners', icon: '▣', label: 'Abrir Inicio/Banners', keywords: 'home carrusel youtube hero' },
  { path: '/admin/customers', icon: '◍', label: 'Abrir Clientes', keywords: 'usuarios compradores' },
  { path: '/admin/invoices', icon: '▤', label: 'Abrir Facturas', keywords: 'comprobantes fiscal' },
  { path: '/admin/analytics', icon: '▴', label: 'Abrir Analiticas', keywords: 'metricas conversion trafico' },
  { path: '/admin/settings', icon: '⚙', label: 'Abrir Configuracion', keywords: 'sync sistema ajustes' },
];

const themeOptions = [
  { value: 'violet', label: 'Violeta', icon: '◈', dot: 'bg-violet-500' },
  { value: 'green', label: 'Verde', icon: '⬢', dot: 'bg-emerald-500' },
  { value: 'red', label: 'Rojo', icon: '✶', dot: 'bg-rose-500' },
];

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(n ?? 0);

const fmtDate = (d) =>
  new Date(d).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

function NotificationPanel({ open, onClose, data, loading }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const pendingOrders = data?.pending_orders ?? 0;
  const lowStock = data?.low_stock_products ?? [];
  const recentOrders = data?.recent_orders ?? [];

  return (
    <div
      ref={ref}
      className="notif-panel-enter absolute right-0 top-12 w-[360px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl shadow-slate-900/15 z-[130] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-cyan-50/60">
        <span className="text-sm font-semibold text-slate-800">Centro de actividad</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-slate-400 text-sm animate-pulse">Cargando señales del sistema...</div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto p-3 space-y-3">
          {pendingOrders > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-amber-700">
                {pendingOrders} pedido{pendingOrders !== 1 ? 's' : ''} pendiente{pendingOrders !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Requieren seguimiento manual</p>
            </div>
          )}

          {lowStock.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.13em] text-rose-500 font-bold mb-1.5">Stock Critico</p>
              <div className="space-y-1.5">
                {lowStock.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5">
                    {p.image_url ? (
                      <img src={p.image_url} className="w-8 h-8 object-contain rounded bg-white border border-rose-100" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-white border border-rose-100 flex items-center justify-center text-xs">▦</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 font-medium truncate">{p.name}</p>
                      <p className="text-[11px] text-rose-600 font-semibold">Solo {p.stock} unidad{p.stock !== 1 ? 'es' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentOrders.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.13em] text-slate-500 font-bold mb-1.5">Ultimos Pedidos</p>
              <div className="space-y-1.5">
                {recentOrders.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 font-medium truncate">
                        {o.buyer_name} {o.buyer_lastname}
                      </p>
                      <p className="text-[11px] text-slate-400">{fmtDate(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-800">{fmtARS(o.total_ars)}</p>
                      <p className="text-[10px] text-slate-500">{o.mp_status || o.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingOrders === 0 && lowStock.length === 0 && recentOrders.length === 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-700">Todo estable</p>
              <p className="text-xs text-emerald-600 mt-0.5">Sin alertas activas por ahora</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommandPalette({
  open,
  query,
  onQueryChange,
  selectedIndex,
  onSelectedIndexChange,
  filteredCommands,
  onClose,
  onSelect,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(id);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-sm p-4 sm:p-6" onClick={onClose}>
      <div
        className="palette-enter admin-surface max-w-2xl mx-auto mt-14 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/70">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Quick Navigator</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className="text-slate-400 text-sm">⌕</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Ir a productos, pedidos, categorias, settings..."
              className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
            />
            <span className="text-[10px] text-slate-400">ESC</span>
          </div>
        </div>

        <div className="p-2 max-h-[390px] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              No hay resultados para "{query}"
            </div>
          ) : (
            filteredCommands.map((command, idx) => (
              <button
                key={command.path}
                type="button"
                onClick={() => onSelect(command)}
                onMouseEnter={() => onSelectedIndexChange(idx)}
                className={`w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all ${
                  idx === selectedIndex
                    ? 'bg-blue-50 border border-blue-200 shadow-sm'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[12px] font-bold text-slate-600">
                  {command.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{command.label}</p>
                  <p className="text-[11px] text-slate-400 truncate">{command.path}</p>
                </div>
                <span className="ml-auto text-[10px] text-slate-400">↵</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen, adminTheme, setAdminTheme } = useApp();
  const title = pageTitles[location.pathname] ?? 'Admin';

  const [searchValue, setSearchValue] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [notifData, setNotifData] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef(null);

  const filteredCommands = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) => {
      const haystack = `${command.label} ${command.path} ${command.keywords}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [paletteQuery]);

  const loadNotifs = useCallback(async () => {
    if (notifLoading) return;
    setNotifLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      const pending = data.orders?.pending ?? 0;
      const lowStock = data.low_stock_products ?? [];
      setNotifData({
        pending_orders: pending,
        low_stock_products: lowStock,
        recent_orders: data.recent_orders ?? [],
      });
      setNotifCount(pending + lowStock.length);
    } catch {
      // Keep quiet in the UI.
    } finally {
      setNotifLoading(false);
    }
  }, [notifLoading]);

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNotifs]);

  useEffect(() => {
    setPanelOpen(false);
    setThemeMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!themeMenuOpen) return undefined;
    const onMouseDown = (event) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [themeMenuOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setThemeMenuOpen(false);
      setPanelOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    setPaletteIndex(0);
  }, [paletteOpen, paletteQuery]);

  useEffect(() => {
    if (!paletteOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPaletteOpen(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPaletteIndex((prev) => Math.min(prev + 1, Math.max(0, filteredCommands.length - 1)));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPaletteIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        const command = filteredCommands[paletteIndex];
        if (command) {
          e.preventDefault();
          navigate(command.path);
          setPaletteOpen(false);
          setPaletteQuery('');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen, paletteIndex, filteredCommands, navigate]);

  const openPalette = () => setPaletteOpen(true);
  const closePalette = () => {
    setPaletteOpen(false);
    setPaletteQuery('');
  };

  const handlePaletteSelect = (command) => {
    navigate(command.path);
    closePalette();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    navigate(`/admin/products?q=${encodeURIComponent(q)}`);
    setSearchValue('');
  };

  const handleBell = () => {
    if (!panelOpen && !notifData) loadNotifs();
    setPanelOpen((v) => !v);
  };
  const currentTheme = themeOptions.find((option) => option.value === adminTheme) || themeOptions[0];

  return (
    <>
      <header className="admin-surface relative z-20 mx-4 mt-4 sm:mx-6 lg:mx-8 rounded-2xl px-4 sm:px-5 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Panel de Control</p>
            <p className="text-sm sm:text-base font-semibold text-slate-800 truncate">{title}</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="hidden md:flex items-center flex-1 max-w-xl mx-2">
          <div className="w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-slate-400 text-sm">⌕</span>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Buscar productos, SKU o marca..."
              className="w-full text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </form>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
            <span className={`w-2 h-2 rounded-full ${
              adminTheme === 'red' ? 'bg-rose-500' : adminTheme === 'green' ? 'bg-emerald-500' : 'bg-violet-500'
            } pulse-live`} />
            <span className="text-[11px] font-semibold text-slate-500">Flujo activo</span>
          </div>

          <button
            onClick={openPalette}
            className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
            title="Abrir atajos"
          >
            Atajos
            <span className="admin-kbd !text-slate-500 !border-slate-200 !bg-slate-100">Ctrl K</span>
          </button>

          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setThemeMenuOpen((prev) => !prev)}
              className="relative w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-800 hover:border-slate-300 transition-colors"
              title={`Color: ${currentTheme.label}`}
              aria-label="Cambiar color del panel"
            >
              {currentTheme.icon}
            </button>
            <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full ring-2 ring-white ${currentTheme.dot}`} />

            {themeMenuOpen && (
              <div className="absolute right-0 top-11 z-[140] w-44 rounded-xl border border-slate-600 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/45 p-1.5">
                <p className="px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300 font-semibold">Paleta</p>
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { setAdminTheme(option.value); setThemeMenuOpen(false); }}
                    className={`w-full mt-1 rounded-lg px-2.5 py-2 text-xs font-semibold border flex items-center gap-2 transition-colors ${
                      adminTheme === option.value
                        ? 'border-slate-500 bg-slate-700/75 text-slate-100'
                        : 'border-transparent text-slate-300 hover:bg-slate-800/85 hover:text-slate-100'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${option.dot}`} />
                    <span>{option.label}</span>
                    <span className="ml-auto text-[12px] opacity-80">{option.icon}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={handleBell}
              className="relative w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
              title="Actividad"
              aria-label="Actividad"
            >
              ⎋
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            <NotificationPanel
              open={panelOpen}
              onClose={() => setPanelOpen(false)}
              data={notifData}
              loading={notifLoading}
            />
          </div>

          <div className={`admin-avatar-led w-9 h-9 rounded-xl text-white text-sm font-bold flex items-center justify-center shadow-md ${
            adminTheme === 'red'
              ? 'bg-gradient-to-br from-rose-500 to-red-500 shadow-rose-500/35'
              : adminTheme === 'green'
                ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/30'
                : 'bg-gradient-to-br from-violet-500 to-indigo-500 shadow-violet-500/30'
          }`}>
            VT
          </div>
        </div>
      </header>

      <CommandPalette
        open={paletteOpen}
        query={paletteQuery}
        onQueryChange={setPaletteQuery}
        selectedIndex={paletteIndex}
        onSelectedIndexChange={setPaletteIndex}
        filteredCommands={filteredCommands}
        onClose={closePalette}
        onSelect={handlePaletteSelect}
      />
    </>
  );
}
