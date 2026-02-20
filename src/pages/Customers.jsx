// src/pages/Customers.jsx
// Panel admin — Clientes reales extraídos de los pedidos de MercadoPago.

import { useState, useEffect } from 'react'
import StatusBadge from '../components/ui/StatusBadge'

const fmtARS = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
}).format(n ?? 0)

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'

const ZONE_LABELS = { CABA: 'CABA', GBA: 'GBA', interior: 'Interior' }

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    fetch('/api/customers')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setCustomers(d.customers ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); })
  }, [])

  const filtered = customers.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex justify-between items-center border-b border-gray-200 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-gray-800">👥 Clientes
            <span className="ml-2 text-sm font-normal text-gray-400">
              {loading ? 'cargando...' : `${total} clientes únicos`}
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Compradores registrados automáticamente desde MercadoPago
          </p>
        </div>
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-64
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="animate-spin text-2xl mr-2">⚙️</div> Cargando clientes...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="m-5 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Tabla */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50">
                {['Cliente', 'Email', 'Zona', 'Pedidos', 'Total gastado', 'Último pedido', 'Estado'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.email} className="hover:bg-gray-50 border-t border-gray-100">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-800">{c.name || '—'}</p>
                    {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{c.email}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {ZONE_LABELS[c.zone] ?? c.zone ?? '—'}
                    {c.city && <span className="block text-xs text-gray-400">{c.city}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-sm">
                    <span className="font-semibold">{c.paid_orders}</span>
                    {c.total_orders !== c.paid_orders && (
                      <span className="text-xs text-gray-400 ml-1">({c.total_orders} total)</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-green-600">
                    {fmtARS(c.total_spent)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {fmtDate(c.last_order)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge
                      status={c.paid_orders > 0 ? 'active' : 'pending'}
                      text={c.paid_orders > 0 ? 'Activo' : 'Nuevo'}
                    />
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-gray-400 text-sm">
                    {search
                      ? 'No se encontraron clientes con ese criterio'
                      : 'Aún no hay clientes. Aparecerán automáticamente cuando alguien compre por MercadoPago.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
