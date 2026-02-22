// src/pages/Analytics.jsx
// Analíticas con datos reales desde /api/dashboard y /api/analytics.
// Muestra: revenue mensual, top productos, desglose por zona y estado.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import StatCard from '../components/ui/StatCard'

const fmtARS = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
}).format(n ?? 0)

const fmtCompact = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return fmtARS(n)
}

const BAR_COLORS = [
  '#0078d4', '#6c63ff', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4',
]

const STATUS_LABELS = {
  pending:   { label: 'Pendiente',  color: 'bg-orange-100 text-orange-700' },
  paid:      { label: 'Pagado',     color: 'bg-blue-100 text-blue-700' },
  shipped:   { label: 'En camino',  color: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Entregado',  color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado',  color: 'bg-red-100 text-red-700' },
}

const ZONE_LABELS = {
  CABA:     'CABA',
  GBA:      'Gran Bs. As.',
  interior: 'Interior',
}

// ── Gráfico de barras reutilizable ────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, height = 160, colorFn }) {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sin datos</div>
  )
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
          {/* Tooltip on hover */}
          <div className="relative w-full flex flex-col items-center justify-end"
               style={{ height: `${Math.max((d[valueKey] / max) * 100, 4)}%` }}>
            <div
              className="w-full rounded-t-md transition-opacity group-hover:opacity-75 relative"
              style={{ height: '100%', background: colorFn ? colorFn(i) : BAR_COLORS[i % BAR_COLORS.length] }}
            >
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px]
                              px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100
                              transition-opacity pointer-events-none z-10">
                {typeof d[valueKey] === 'number' && d[valueKey] > 1000
                  ? fmtCompact(d[valueKey])
                  : d[valueKey]}
              </div>
            </div>
          </div>
          <span className="text-[9px] text-gray-400 text-center leading-tight w-full truncate px-0.5">
            {d[labelKey]}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Analytics() {
  const [dash,       setDash]       = useState(null)
  const [analytics,  setAnalytics]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => { if (!r.ok) throw new Error(`dashboard ${r.status}`); return r.json() }),
      fetch('/api/analytics').then(r => { if (!r.ok) throw new Error(`analytics ${r.status}`); return r.json() }),
    ])
      .then(([d, a]) => { setDash(d); setAnalytics(a) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin text-3xl mr-3">⚙️</div> Cargando analíticas...
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
      ⚠️ No se pudieron cargar las analíticas. {error}
    </div>
  )

  const revenue     = dash?.revenue     ?? {}
  const orders      = dash?.orders      ?? {}
  const customers   = dash?.customers   ?? {}
  const monthly     = analytics?.monthly_revenue  ?? []
  const topProducts = analytics?.top_products     ?? []
  const zones       = analytics?.zone_breakdown   ?? []
  const statuses    = analytics?.status_breakdown ?? []

  const totalOrders = orders.total ?? 0
  const totalRevenuePrev = monthly.length >= 2
    ? monthly[monthly.length - 2]?.revenue ?? 0
    : 0
  const totalRevenueCurr = monthly.length >= 1
    ? monthly[monthly.length - 1]?.revenue ?? 0
    : 0
  const revenueChange = totalRevenuePrev > 0
    ? (((totalRevenueCurr - totalRevenuePrev) / totalRevenuePrev) * 100).toFixed(1)
    : null

  const topRevenue = topProducts[0]?.revenue ?? 1

  return (
    <>
      <section className="mb-6 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-700 text-white p-5 sm:p-6 shadow-xl shadow-blue-900/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-blue-100/85 font-semibold">Vista Estratégica</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">Analíticas de negocio</h1>
            <p className="text-blue-100/90 text-sm mt-1">
              Tendencias de ingresos, productos top y distribución de pedidos por zona y estado.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-blue-700 px-4 py-2.5 text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            Ver dashboard
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-5 inline-flex rounded-xl border border-white/20 bg-white/5 p-1">
          <Link
            to="/admin"
            className="px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <span className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-semibold">
            Analíticas
          </span>
        </div>
      </section>

      {/* ── Tarjetas resumen ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="💰" iconBg="bg-blue-100"
          value={fmtCompact(revenue.total ?? 0)}
          label="Ingresos totales"
          change={revenueChange ? `${Math.abs(revenueChange)}%` : null}
          up={revenueChange >= 0}
        />
        <StatCard
          icon="📅" iconBg="bg-green-100"
          value={fmtCompact(revenue.last30d ?? 0)}
          label="Últimos 30 días"
        />
        <StatCard
          icon="📦" iconBg="bg-yellow-100"
          value={totalOrders.toLocaleString('es-AR')}
          label="Pedidos totales"
          change={orders.paid ? `${orders.paid} pagados` : null}
          up
        />
        <StatCard
          icon="👥" iconBg="bg-pink-100"
          value={(customers.unique ?? 0).toLocaleString('es-AR')}
          label="Clientes únicos"
        />
      </div>

      {/* ── Gráficos fila 1 ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Ingresos mensuales */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">📈 Ingresos mensuales</h3>
            <span className="text-xs text-gray-400">Últimos 6 meses</span>
          </div>
          {monthly.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-300 text-sm">
              Sin pedidos en el período
            </div>
          ) : (
            <>
              <BarChart data={monthly} valueKey="revenue" labelKey="label" height={160} />
              {/* Totales debajo */}
              <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-xs text-gray-500">
                <span>Total período: <strong className="text-gray-700">{fmtCompact(monthly.reduce((s,m) => s + m.revenue, 0))}</strong></span>
                <span>{monthly.reduce((s,m) => s + m.orders, 0)} pedidos</span>
              </div>
            </>
          )}
        </div>

        {/* Top productos */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">🏆 Top Productos</h3>
            <span className="text-xs text-gray-400">Por ingresos</span>
          </div>
          {topProducts.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-300 text-sm">
              Sin ventas registradas
            </div>
          ) : (
            <div className="space-y-2.5">
              {topProducts.slice(0, 6).map((p, i) => (
                <div key={p.title} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-5 text-right flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-xs font-semibold text-gray-700 truncate pr-2">{p.title}</p>
                      <span className="text-xs font-bold text-gray-800 flex-shrink-0">{fmtCompact(p.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(p.revenue / topRevenue) * 100}%`,
                          background: BAR_COLORS[i % BAR_COLORS.length],
                        }}
                      />
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-[10px] text-gray-400">{p.units_sold} uds</span>
                      <span className="text-[10px] text-gray-400">{p.order_count} pedidos</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Gráficos fila 2 ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Desglose por zona */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">📍 Desglose por zona</h3>
          </div>
          {zones.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-300 text-sm">Sin datos</div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const maxOrders = Math.max(...zones.map(z => z.orders), 1)
                return zones.map((z, i) => (
                  <div key={z.zone}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-700">
                        {ZONE_LABELS[z.zone] ?? z.zone}
                      </span>
                      <div className="flex gap-4 text-gray-500">
                        <span>{z.orders} pedidos</span>
                        <span className="font-semibold text-gray-700">{fmtCompact(z.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(z.orders / maxOrders) * 100}%`,
                          background: BAR_COLORS[i % BAR_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>

        {/* Distribución por estado */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">📊 Estado de pedidos</h3>
            <span className="text-xs text-gray-400">{totalOrders} total</span>
          </div>
          {statuses.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-300 text-sm">Sin datos</div>
          ) : (
            <div className="space-y-2.5">
              {statuses.map(s => {
                const meta = STATUS_LABELS[s.status] ?? { label: s.status, color: 'bg-gray-100 text-gray-600' }
                const pct  = totalOrders > 0 ? Math.round((s.total / totalOrders) * 100) : 0
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-24 text-center flex-shrink-0 ${meta.color}`}>
                      {meta.label}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 w-16 justify-end flex-shrink-0">
                      <span className="font-semibold text-gray-700">{s.total}</span>
                      <span>({pct}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Últimos 7 días (del dashboard) ───────────────────────────────── */}
      {dash?.daily_chart?.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">📆 Últimos 7 días</h3>
            <span className="text-xs text-gray-400">Pedidos e ingresos por día</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {dash.daily_chart.map((d, i) => (
              <div key={i} className="text-center">
                <div className="bg-blue-50 rounded-lg p-2.5 mb-1.5">
                  <p className="text-sm font-bold text-blue-700">{d.orders}</p>
                  <p className="text-[10px] text-blue-400">ped.</p>
                </div>
                <p className="text-[10px] text-gray-500 font-medium">{fmtCompact(d.revenue)}</p>
                <p className="text-[9px] text-gray-400 capitalize">{d.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
