import { useCart } from '../../context/CartContext';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  const formatARS = (n) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(n);

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
      <div className="bg-gray-50 h-48 flex items-center justify-center overflow-hidden">
        {product.image_url
          ? <img src={product.image_url} alt={product.name}
              className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300 p-2" />
          : <span className="text-6xl">📦</span>
        }
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded truncate max-w-[60%]">{product.category}</span>
          <span className="text-xs text-gray-400">{product.brand}</span>
        </div>
        <h3 className="font-semibold text-gray-800 mb-1 text-sm line-clamp-2">{product.name}</h3>
        <p className="text-xs text-gray-400 mb-3">Garantía: {product.warranty}</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-gray-800">{formatARS(product.price_ars)}</p>
            <p className="text-xs text-gray-400">USD {product.price_usd?.toFixed(2)}</p>
          </div>
          <button onClick={() => addToCart({ ...product, price: product.price_ars })}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors active:scale-95">
            🛒 Agregar
          </button>
        </div>
        {product.stock < 10 && product.stock > 0 &&
          <p className="text-xs text-orange-500 mt-2">⚠️ Solo quedan {product.stock} unidades</p>}
      </div>
    </div>
  );
}