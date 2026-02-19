// src/pages/Orders.jsx
// Panel admin — Pedidos conectados a Azure SQL.
// Lee pedidos reales de MercadoPago y permite cambiar su estado.

import { useState, useEffect, useCallback } from 'react'
import StatusBadge from '../components/ui/StatusBadge'

// ── Config de estados internos ────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pendiente',  badge: 'pending' },
  { value: 'paid',      label: 'Pagado',     badge: 'active' },
  { value: 'shipped',   label: 'En camino',  badge: 'shipped' },
  { value: 'delivered', label: 'Entregado',  badge: 'active' },
  { value: 'cancelled', label: 'Cancelado',  badge: 'cancelled' },
]

const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]))

const fmtARS = (n) => n != null
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  : '—'

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

// ── Modal detalle de pedido ────────────────────────────────────────────────────
function OrderModal({ order, onClose, onStatusChange }) {
  const [status,  setStatus]  = useState(order.status)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  const handleSave = async () => {
    if (status === order.status) { onClose(); return; }
    setSaving(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: order.id, status }),
      })
      if (!res.ok) throw new Error()
      onStatusChange(order.id, status)
      onClose()
    } catch {
      setError('Error al guardar el estado')
      setSaving(false)
    }
  }

  const cfg = STATUS_MAP[order.status] ?? STATUS_MAP['pending']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-start">
          <div>
            <h3 className="font-bold text-gray-800">Pedido #{order.id}</h3>
            <p className="text-xs text-gray-400 mt-0.5">MP: {order.mp_payment_id}</p>
          </div>
          <StatusBadge status={cfg.badge} text={cfg.label} />
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Comprador */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5 text-sm">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">👤 Comprador</h4>
            <p className="font-semibold text-gray-800">{order.buyer_name} {order.buyer_lastname}</p>
            <p className="text-gray-500">{order.buyer_email}</p>
            {order.buyer_phone   && <p className="text-gray-500">📱 {order.buyer_phone}</p>}
            {order.buyer_address && <p className="text-gray-500">📍 {order.buyer_address}, {order.buyer_city} ({order.buyer_zone})</p>}
          </div>

          {/* Productos */}
          {order.items?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">🛒 Productos</h4>
              <div className="space-y-1.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.title} × {item.quantity}</span>
                    <span className="font-semibold text-gray-800">{fmtARS(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between items-center border-t border-gray-100 pt-3">
            <span className="text-sm font-semibold text-gray-600">Total</span>
            <span className="text-lg font-bold text-green-600">{fmtARS(order.total_ars)}</span>
          </div>

          {/* Cambiar estado */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">🔄 Cambiar estado</h4>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`px-2 py-2 rounded-lg text-xs font-semibold border-2 transition-all
                    ${status === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">
            Cerrar
          </button>
          <button onClick={handleSave} disabled={saving || status === order.status}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold
                       hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Guardando...' : 'Guardar estado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Orders() {
  const [orders,       setOrders]       = useState([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [selected,     setSelected]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filterStatus) params.set('status', filterStatus)
      const res = await fetch(`/api/orders?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setOrders(data.orders ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  // Actualiza el estado del pedido en la lista local sin recargar todo
  const handleStatusChange = (id, newStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 flex justify-between items-center border-b border-gray-200 flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">📦 Pedidos
              <span className="ml-2 text-sm font-normal text-gray-400">
                {loading ? 'cargando...' : `${total} pedidos`}
              </span>
            </h3>
          </div>

          {/* Filtro por estado */}
          <div className="flex items-center gap-2 flex-wrap">
            {[{ value: '', label: 'Todos' }, ...STATUS_OPTIONS].map(opt => (
              <button key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                  ${filterStatus === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                {opt.label}
              </button>
            ))}
            <button onClick={load}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-500">
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="animate-spin text-2xl mr-2">⚙️</div> Cargando pedidos...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="m-5 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <strong>No se pudieron cargar los pedidos.</strong>
              <p className="text-xs mt-0.5 text-red-500">{error}</p>
            </div>
            <button onClick={load}
              className="ml-auto px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-semibold">
              Reintentar
            </button>
          </div>
        )}

        {/* Tabla */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-gray-50">
                  {['#', 'Cliente', 'Email', 'Productos', 'Total ARS', 'Estado', 'Fecha', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const cfg = STATUS_MAP[o.status] ?? STATUS_MAP['pending']
                  const productNames = o.items?.map(i => i.title).join(', ') || '—'
                  return (
                    <tr key={o.id}
                      className="hover:bg-gray-50 border-t border-gray-100 cursor-pointer"
                      onClick={() => setSelected(o)}>
                      <td className="px-4 py-3.5 text-xs font-mono text-gray-500">#{o.id}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-800 whitespace-nowrap">
                        {o.buyer_name} {o.buyer_lastname}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{o.buyer_email}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 max-w-[200px] truncate">
                        {productNames}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-green-700 whitespace-nowrap">
                        {fmtARS(o.total_ars)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={cfg.badge} text={cfg.label} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                        {fmtDate(o.created_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-gray-300 hover:text-gray-500 text-lg">›</span>
                      </td>
                    </tr>
                  )
                })}

                {orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-400 text-sm">
                      {filterStatus
                        ? `No hay pedidos con estado "${STATUS_MAP[filterStatus]?.label}"`
                        : 'Aún no hay pedidos. Aparecerán aquí cuando alguien pague por MercadoPago.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {selected && (
        <OrderModal
          order={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  )
}
