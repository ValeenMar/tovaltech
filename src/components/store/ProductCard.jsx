import { useCart } from '../../context/CartContext';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0);

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  const handleAdd = () => {
    addToCart({
      id:       product.id,
      name:     product.name,
      category: product.category,
      emoji:    product.emoji ?? '📦',
      image_url: product.image_url ?? null,
      price:    product.price_ars,   // CartContext usa `price` para los cálculos
      price_usd: product.price_usd,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
      {/* Imagen / Emoji */}
      <div className="bg-gray-50 h-48 flex items-center justify-center overflow-hidden">
        {product.image_url
          ? <img src={product.image_url} alt={product.name}
              className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300 p-2" />
          : <span className="text-6xl select-none">{product.emoji ?? '📦'}</span>
        }
      </div>

      <div className="p-5">
        {/* Categoría + Marca */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded truncate max-w-[60%]">
            {product.category}
          </span>
          {product.brand && (
            <span className="text-xs text-gray-400 truncate">{product.brand}</span>
          )}
        </div>

        {/* Nombre */}
        <h3 className="font-semibold text-gray-800 mb-1 text-sm line-clamp-2">{product.name}</h3>

        {/* Garantía */}
        {product.warranty && (
          <p className="text-xs text-gray-400 mb-3">Garantía: {product.warranty}</p>
        )}

        {/* Rating */}
        {product.rating > 0 && (
          <div className="flex items-center gap-1 mb-3">
            <span className="text-yellow-400 text-xs">{'★'.repeat(Math.round(product.rating))}</span>
            <span className="text-xs text-gray-400">({product.rating})</span>
          </div>
        )}

        {/* Precios + botón */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-gray-800">{fmtARS(product.price_ars)}</p>
            {product.price_usd && (
              <p className="text-xs text-gray-400">USD {product.price_usd?.toFixed(2)}</p>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🛒 Agregar
          </button>
        </div>

        {/* Stock bajo */}
        {product.stock > 0 && product.stock < 10 && (
          <p className="text-xs text-orange-500 mt-2">⚠️ Solo quedan {product.stock} unidades</p>
        )}
        {product.stock === 0 && (
          <p className="text-xs text-red-500 mt-2">❌ Sin stock</p>
        )}
      </div>
    </div>
  );
}
