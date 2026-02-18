import { useApp } from '../../context/AppContext'

const pageTitles = {
  dashboard: 'Dashboard', orders: 'Pedidos', products: 'Productos',
  customers: 'Clientes', invoices: 'Facturas', analytics: 'Analíticas', settings: 'Configuración',
}

export default function Topbar() {
  const { currentPage, sidebarOpen, setSidebarOpen } = useApp()

  return (
    <header className="bg-white px-6 py-3 flex items-center justify-between border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-xl hover:text-azure-500 transition-colors">
          ☰
        </button>
        <span className="text-sm text-gray-400">
          Inicio / <span className="text-gray-900 font-semibold">{pageTitles[currentPage]}</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="🔍 Buscar..."
          className="hidden sm:block bg-gray-100 border border-gray-200 rounded-lg px-3.5 py-2 text-sm w-60 outline-none focus:border-azure-500 transition-colors"
        />
        <button className="relative text-xl">
          🔔
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-azure-500 flex items-center justify-center text-white text-sm font-semibold cursor-pointer">
          AD
        </div>
      </div>
    </header>
  )
}