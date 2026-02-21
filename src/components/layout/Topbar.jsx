// src/components/layout/Topbar.jsx
// Topbar del admin:
// - Búsqueda global funcional: Enter navega a /admin/products?q=término
// - Campanita con pedidos pendientes y stock crítico
// - Sonido FNAF (honk de la nariz de Freddy) al hacer click en la campana

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

const pageTitles = {
  '/admin':            'Dashboard',
  '/admin/orders':     'Pedidos',
  '/admin/products':   'Productos',
  '/admin/categories': 'Categorías',
  '/admin/banners':    'Inicio',
  '/admin/customers':  'Clientes',
  '/admin/invoices':   'Facturas',
  '/admin/analytics':  'Analíticas',
  '/admin/settings':   'Configuración',
}

// ── FNAF Freddy Fazbear nose honk ──────────────────────────────────────────────
function playFNAFHonk() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()

    const osc1  = ctx.createOscillator()
    const osc2  = ctx.createOscillator()
    const gain1 = ctx.createGain()
    const gain2 = ctx.createGain()
    const wave  = ctx.createWaveShaper()
    const curve = new Float32Array(256)
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1
      curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x))
    }
    wave.curve = curve

    osc1.type = 'sawtooth'
    osc2.type = 'sine'

    osc1.frequency.setValueAtTime(420, ctx.currentTime)
    osc1.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.18)
    osc2.frequency.setValueAtTime(840, ctx.currentTime)
    osc2.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.18)

    gain1.gain.setValueAtTime(0,    ctx.currentTime)
    gain1.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 0.012)
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42)

    gain2.gain.setValueAtTime(0,    ctx.currentTime)
    gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.012)
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38)

    osc1.connect(gain1)
    osc2.connect(gain2)
    gain1.connect(wave)
    gain2.connect(wave)
    wave.connect(ctx.destination)

    osc1.start(ctx.currentTime)
    osc2.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.5)
    osc2.stop(ctx.currentTime + 0.5)

    setTimeout(() => ctx.close(), 600)
  } catch (e) {
    // Navegadores sin Web Audio API — fail silencioso
  }
}

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0)

const fmtDate = (d) =>
  new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// ── Panel de notificaciones ────────────────────────────────────────────────────
function NotifPanel({ open, onClose, data, loading }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open) return null

  const pendingOrders = data?.pending_orders ?? 0
  const lowStock      = data?.low_stock_products ?? []
  const recentOrders  = data?.recent_orders ?? []

  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
      style={{ animation: 'fadeSlideDown 0.18s ease' }}
    >
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <span className="font-semibold text-gray-800 text-sm">🔔 Notificaciones</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-gray-400 text-sm animate-pulse">Cargando...</div>
      ) : (
        <div className="max-h-96 overflow-y-auto">

          {pendingOrders > 0 && (
            <div className="mx-3 mt-3 mb-1 bg-orange-50 border border-orange-100 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📦</span>
                <div>
                  <p className="font-semibold text-orange-700 text-sm">
                    {pendingOrders} pedido{pendingOrders !== 1 ? 's' : ''} pendiente{pendingOrders !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-orange-500">Requieren atención</p>
                </div>
              </div>
            </div>
          )}

          {lowStock.length > 0 && (
            <div className="px-3 pt-2 pb-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">
                ⚠️ Stock crítico
              </p>
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 py-1.5 px-1 hover:bg-gray-50 rounded-lg">
                  {p.image_url
                    ? <img src={p.image_url} className="w-8 h-8 object-contain rounded" alt="" />
                    : <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm">📦</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{p.name}</p>
                    <p className="text-[11px] text-red-500 font-semibold">Solo {p.stock} unidad{p.stock !== 1 ? 'es' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentOrders.length > 0 && (
            <div className="px-3 pt-2 pb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">
                🕐 Pedidos recientes
              </p>
              {recentOrders.slice(0, 4).map(o => (
                <div key={o.id} className="flex items-center justify-between py-1.5 px-1 hover:bg-gray-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {o.buyer_name} {o.buyer_lastname}
                    </p>
                    <p className="text-[11px] text-gray-400">{fmtDate(o.created_at)}</p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-800">{fmtARS(o.total_ars)}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full
                      ${o.status === 'paid' || o.mp_status === 'approved' ? 'bg-green-100 text-green-700'
                        : o.status === 'pending' ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-500'}`}>
                      {o.mp_status === 'approved' ? 'Pagado' : o.status === 'pending' ? 'Pendiente' : o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingOrders === 0 && lowStock.length === 0 && recentOrders.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              <p className="text-2xl mb-2">✅</p>
              Todo en orden, no hay alertas
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Topbar principal ───────────────────────────────────────────────────────────
export default function Topbar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { sidebarOpen, setSidebarOpen } = useApp()
  const title     = pageTitles[location.pathname] ?? 'Admin'

  const [panelOpen, setPanelOpen]       = useState(false)
  const [notifData, setNotifData]       = useState(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifCount, setNotifCount]     = useState(0)

  // ── Búsqueda global ──────────────────────────────────────────────────────
  const [searchValue, setSearchValue] = useState('')

  const handleSearch = (e) => {
    e.preventDefault()
    const q = searchValue.trim()
    if (!q) return
    // Navega a productos con el término de búsqueda como query param
    // Products.jsx lo lee desde la URL al montar
    navigate(`/admin/products?q=${encodeURIComponent(q)}`)
    setSearchValue('')
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') setSearchValue('')
  }

  // ── Notificaciones ───────────────────────────────────────────────────────
  const loadNotifs = useCallback(async () => {
    if (notifLoading) return
    setNotifLoading(true)
    try {
      const res  = await fetch('/api/dashboard')
      const data = await res.json()
      const pending  = data.orders?.pending ?? 0
      const lowStock = data.low_stock_products ?? []
      setNotifData({
        pending_orders:     pending,
        low_stock_products: lowStock,
        recent_orders:      data.recent_orders ?? [],
      })
      setNotifCount(pending + lowStock.length)
    } catch {
      // Si falla, igual se abre el panel vacío
    } finally {
      setNotifLoading(false)
    }
  }, [notifLoading])

  useEffect(() => {
    loadNotifs()
    const interval = setInterval(loadNotifs, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  const handleBell = () => {
    playFNAFHonk()
    if (!panelOpen && !notifData) loadNotifs()
    setPanelOpen(v => !v)
  }

  return (
    <header className="bg-white px-6 py-3 flex items-center justify-between border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-xl hover:text-azure-500 transition-colors">
          ☰
        </button>
        <span className="text-sm text-gray-400">
          Inicio / <span className="text-gray-900 font-semibold">{title}</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* 🔍 Búsqueda global — navega a Productos al hacer Enter */}
        <form onSubmit={handleSearch} className="hidden sm:block">
          <input
            id="admin-search"
            name="admin-search"
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="🔍 Buscar productos..."
            className="bg-gray-100 border border-gray-200 rounded-lg px-3.5 py-2 text-sm w-60
                       outline-none focus:border-blue-400 focus:bg-white transition-all"
          />
        </form>

        {/* 🔔 Campanita con panel */}
        <div className="relative">
          <button
            onClick={handleBell}
            className="relative text-xl hover:scale-110 active:scale-95 transition-transform select-none"
            title="Notificaciones (🔔 boop)"
            aria-label="Ver notificaciones"
          >
            🔔
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          <NotifPanel
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            data={notifData}
            loading={notifLoading}
          />
        </div>

        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold cursor-pointer">
          V
        </div>
      </div>
    </header>
  )
}
