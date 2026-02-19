import { useApp } from '../context/AppContext'
import StatusBadge from '../components/ui/StatusBadge'

export default function Invoices() {
  const { invoices } = useApp()

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 flex justify-between items-center border-b border-gray-200">
        <h3 className="font-semibold">🧾 Facturas (Azure Blob Storage)</h3>
        <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50">📤 Exportar</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead><tr className="bg-gray-50">
            {['Factura','Cliente','Monto','Fecha','Estado','Acción'].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {invoices.map(i => (
              <tr key={i.id} className="hover:bg-gray-50 border-t border-gray-100">
                <td className="px-5 py-3.5 text-sm font-semibold">{i.id}</td>
                <td className="px-5 py-3.5 text-sm">{i.customer}</td>
                <td className="px-5 py-3.5 text-sm font-semibold">{i.amount}</td>
                <td className="px-5 py-3.5 text-sm">{i.date}</td>
                <td className="px-5 py-3.5"><StatusBadge status={i.status} text={i.statusText} /></td>
                <td className="px-5 py-3.5"><button className="px-2.5 py-1 border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50">📄 PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}