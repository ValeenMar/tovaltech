import { useApp } from '../context/AppContext'
import { fmtUSD } from '../data/products'

export default function Products() {
  const { products, openModal, removeProduct } = useApp()

  return (
    <>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h3 className="font-semibold text-lg">🏷️ Catálogo de Productos</h3>
        <button
          onClick={() => openModal('product')}
          className="px-4 py-2 bg-azure-500 text-white rounded-lg text-sm font-semibold hover:bg-azure-600"
        >
          + Nuevo Producto
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {products.map(p => (
          <div
            key={p.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all group"
          >
            {/* Imagen / emoji */}
            <div className="h-28 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden relative">
              {p.image_url
                ? <img src={p.image_url} alt={p.name} className="h-full w-full object-contain p-2" />
                : <span className="text-5xl select-none">{p.emoji ?? '📦'}</span>
              }
              {/* Botón eliminar al hover */}
              <button
                onClick={() => removeProduct(p.id)}
                title="Eliminar producto"
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full text-xs
                           opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >✕</button>
              {/* Badge featured */}
              {p.featured && (
                <span className="absolute top-1.5 left-1.5 text-[9px] bg-yellow-400 text-yellow-900 font-bold px-1.5 py-0.5 rounded">
                  ⭐ Dest.
                </span>
              )}
            </div>

            <div className="p-3.5">
              <h4 className="text-sm font-semibold mb-0.5 line-clamp-2">{p.name}</h4>
              {p.brand && <p className="text-[11px] text-gray-400 mb-1">{p.brand}</p>}
              <div className="text-azure-500 font-bold">{fmtUSD(p.price_usd)}</div>
              <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                <span>{p.stock > 10 ? '✅' : p.stock > 0 ? '⚠️' : '❌'}</span>
                <span>{p.stock} en stock</span>
                <span className="text-gray-300">·</span>
                <span>{p.category}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
