import { useApp } from '../context/AppContext'
import StatusBadge from '../components/ui/StatusBadge'

export default function Orders() {
  const { orders, openModal } = useApp()

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 flex justify-between items-center border-b border-gray-200 flex-wrap gap-2">
        <h3 className="font-semibold">📦 Gestión de Pedidos</h3>
        <button onClick={() => openModal('order')} className="px-4 py-2 bg-azure-500 text-white rounded-lg text-sm font-semibold hover:bg-azure-600 transition-colors">
          + Nuevo Pedido
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-gray-50">
              {['ID','Cliente','Producto','Total','Estado','Fecha'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-50 border-t border-gray-100">
                <td className="px-5 py-3.5 text-sm font-semibold">{o.id}</td>
                <td className="px-5 py-3.5 text-sm">{o.customer}</td>
                <td className="px-5 py-3.5 text-sm">{o.product}</td>
                <td className="px-5 py-3.5 text-sm font-semibold">{o.total}</td>
                <td className="px-5 py-3.5"><StatusBadge status={o.status} text={o.statusText} /></td>
                <td className="px-5 py-3.5 text-sm">{o.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}