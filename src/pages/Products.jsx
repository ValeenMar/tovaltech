import { useApp } from '../context/AppContext'

export default function Products() {
  const { products, openModal } = useApp()

  return (
    <>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h3 className="font-semibold text-lg">🏷️ Catálogo de Productos</h3>
        <button onClick={() => openModal('product')} className="px-4 py-2 bg-azure-500 text-white rounded-lg text-sm font-semibold hover:bg-azure-600">
          + Nuevo Producto
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {products.map(p => (
          <div key={p.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all cursor-pointer">
            <div className="h-28 flex items-center justify-center text-5xl bg-gradient-to-br from-blue-50 to-blue-100">
              {p.emoji}
            </div>
            <div className="p-3.5">
              <h4 className="text-sm font-semibold mb-1">{p.name}</h4>
              <div className="text-azure-500 font-bold">{p.price}</div>
              <div className="text-[11px] text-gray-400 mt-1">
                {p.stock > 10 ? '✅' : '⚠️'} {p.stock} en stock · {p.category}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}