// src/pages/Dashboard.jsx
// Panel admin — Dashboard conectado a datos reales desde Azure SQL.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'

const fmtARS = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
}).format(n ?? 0)

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—'

const STATUS_MAP = {
  pending:   { badge: 'pending',   label: 'Pendiente' },
  paid:      { badge: 'active',    label: 'Pagado' },
  shipped:   { badge: 'shipped',   label: 'En camino' },
  delivered: { badge: 'active',    label: 'Entregado' },
  cancelled: { badge: 'cancelled', label: 'Cancelado' },
}

const CHART_COLORS = ['#0078d4','#6c63ff','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6']

export default function Dashboard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin text-3xl mr-3">⚙️</div> Cargando dashboard...
    </div>
  )

  if (error || !data) return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
      ⚠️ No se pudo cargar el dashboard. {error}
    </div>
  )

  // Gráfico: últimos 7 días (rellenamos los días que no tienen datos)
  const chartData = data.daily_chart ?? []
  const chartMax  = Math.max(...chartData.map(d => d.revenue), 1)

  // Donut de estados
  const total     = data.orders.total || 1
  const donutData = [
    { label: 'Entregados', value: data.orders.delivered, color: '#10b981' },
    { label: 'En camino',  value: data.orders.shipped,   color: '#0078d4' },
    { label: 'Pendientes', value: data.orders.pending,   color: '#f59e0b' },
    { label: 'Cancelados', value: data.orders.cancelled, color: '#ef4444' },
  ]

  let accumulated = 0
  const conicStops = donutData.map(d => {
    const pct  = (d.value / total) * 100
    const from = accumulated
    accumulated += pct
    return `${d.color} ${from.toFixed(1)}% ${accumulated.toFixed(1)}%`
  }).join(', ')

  return (
    <>
      <section className="mb-6 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-900 to-blue-900 text-white p-5 sm:p-6 shadow-xl shadow-slate-900/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-blue-200/80 font-semibold">Vista Operativa</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">Dashboard diario</h1>
            <p className="text-blue-100/85 text-sm mt-1">
              Seguimiento de caja, pedidos recientes y alertas de stock en tiempo real.
            </p>
          </div>
          <Link
            to="/admin/analytics"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-blue-700 px-4 py-2.5 text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            Ver analíticas
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-5 inline-flex rounded-xl border border-white/20 bg-white/5 p-1">
          <span className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-semibold">
            Dashboard
          </span>
          <Link
            to="/admin/analytics"
            className="px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white transition-colors"
          >
            Analíticas
          </Link>
        </div>
      </section>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="💰" iconBg="bg-blue-100"
          value={fmtARS(data.revenue.last30d)}
          label="Ingresos últimos 30 días"
          change={null}
        />
        <StatCard
          icon="📦" iconBg="bg-green-100"
          value={data.orders.total}
          label="Pedidos totales"
          change={null}
        />
        <StatCard
          icon="👥" iconBg="bg-yellow-100"
          value={data.customers.unique}
          label="Clientes únicos"
          change={null}
        />
        <StatCard
          icon="🏷️" iconBg="bg-pink-100"
          value={data.products.in_stock}
          label={`Productos en stock (${data.products.low_stock} bajo)`}
          change={null}
          up={data.products.low_stock === 0}
        />
      </div>

      {/* ── Gráficos ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

        {/* Gráfico de barras — ingresos últimos 7 días */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="font-semibold mb-1">Ingresos últimos 7 días</h3>
          <p className="text-xs text-gray-400 mb-4">Solo pagos aprobados por MercadoPago</p>
          {chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-300 text-sm">
              Sin datos aún
            </div>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {chartData.map((d, i) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[9px] text-gray-400 font-mono">
                    {d.revenue > 0 ? fmtARS(d.revenue).replace('$\u00a0', '$') : ''}
                  </span>
                  <div
                    className="w-full rounded-t-md transition-all duration-500 hover:opacity-80 min-h-[4px]"
                    style={{
                      height: `${Math.max((d.revenue / chartMax) * 100, 3)}%`,
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                    title={`${d.label}: ${fmtARS(d.revenue)}`}
                  />
                  <span className="text-[10px] text-gray-400">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Donut — estado de pedidos */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="font-semibold mb-4">Estado de pedidos</h3>
          {data.orders.total === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-300 text-sm">
              Sin pedidos aún
            </div>
          ) : (
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <div className="w-32 h-32 rounded-full relative flex-shrink-0" style={{
                background: `conic-gradient(${conicStops})`
              }}>
                <div className="absolute inset-0 m-auto w-[70px] h-[70px] bg-white rounded-full flex flex-col items-center justify-center">
                  <strong className="text-lg">{data.orders.total}</strong>
                  <small className="text-[10px] text-gray-400">Total</small>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                {donutData.map(d => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-gray-600">{d.label}</span>
                    <span className="font-semibold ml-auto pl-3">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fila inferior ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pedidos recientes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold text-sm">
            📦 Pedidos recientes
          </div>
          {data.recent_orders.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-300 text-sm">
              Aún no hay pedidos
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.recent_orders.map(o => {
                const cfg = STATUS_MAP[o.status] ?? STATUS_MAP['pending']
                return (
                  <div key={o.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {o.buyer_name} {o.buyer_lastname}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{o.buyer_email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-600">{fmtARS(o.total_ars)}</p>
                      <p className="text-[10px] text-gray-400">{fmtDate(o.created_at)}</p>
                    </div>
                    <StatusBadge status={cfg.badge} text={cfg.label} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Stock crítico */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold text-sm flex justify-between items-center">
            <span>⚠️ Stock crítico (≤ 3 unidades)</span>
            {data.products.out_of_stock > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                {data.products.out_of_stock} sin stock
              </span>
            )}
          </div>
          {data.low_stock_products.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-300 text-sm">
              ✅ Todos los productos tienen stock suficiente
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.low_stock_products.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-1"
                             onError={e => { e.target.style.display = 'none' }} />
                      : <span className="text-xl">📦</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.brand} · {p.category}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0
                    ${p.stock <= 1 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                    {p.stock} ud.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
