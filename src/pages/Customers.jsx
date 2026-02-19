import { useApp } from '../context/AppContext'
import StatusBadge from '../components/ui/StatusBadge'

export default function Customers() {
  const { customers, openModal } = useApp()

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 flex justify-between items-center border-b border-gray-200 flex-wrap gap-2">
        <h3 className="font-semibold">👥 Clientes (Azure AD B2C)</h3>
        <button onClick={() => openModal('customer')} className="px-4 py-2 bg-azure-500 text-white rounded-lg text-sm font-semibold hover:bg-azure-600">
          + Invitar Cliente
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead><tr className="bg-gray-50">
            {['ID','Nombre','Email','Pedidos','Gastado','Estado'].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 border-t border-gray-100">
                <td className="px-5 py-3.5 text-sm">{c.id}</td>
                <td className="px-5 py-3.5 text-sm font-semibold">{c.name}</td>
                <td className="px-5 py-3.5 text-sm">{c.email}</td>
                <td className="px-5 py-3.5 text-sm">{c.orders}</td>
                <td className="px-5 py-3.5 text-sm font-semibold">{c.spent}</td>
                <td className="px-5 py-3.5"><StatusBadge status={c.status} text={c.status === 'active' ? 'Activo' : 'Nuevo'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}