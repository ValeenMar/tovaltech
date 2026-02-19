import { useCart } from '../../context/CartContext';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
      <div className="bg-gray-50 h-48 flex items-center justify-center text-7xl group-hover:scale-110 transition-transform duration-300">
        {product.image}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">{product.category}</span>
          <span className="text-xs text-yellow-500">⭐ {product.rating}</span>
        </div>
        <h3 className="font-semibold text-gray-800 mb-1">{product.name}</h3>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-gray-800">${product.price.toFixed(2)}</span>
          <button onClick={() => addToCart(product)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors active:scale-95">
            🛒 Agregar
          </button>
        </div>
        {product.stock < 10 && <p className="text-xs text-orange-500 mt-2">⚠️ Solo quedan {product.stock} unidades</p>}
      </div>
    </div>
  );
}