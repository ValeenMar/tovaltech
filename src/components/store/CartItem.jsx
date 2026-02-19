import { useCart } from '../../context/CartContext';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0);

export default function CartItem({ item }) {
  const { updateQuantity, removeFromCart } = useCart();

  return (
    <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
      {/* Imagen o emoji */}
      <div className="bg-gray-50 w-20 h-20 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
        {item.image_url
          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-1" />
          : <span className="text-4xl select-none">{item.emoji ?? '📦'}</span>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800 truncate">{item.name}</h3>
        <p className="text-sm text-gray-500">{item.category}</p>
        <p className="text-blue-600 font-bold mt-1">{fmtARS(item.price)}</p>
      </div>

      {/* Cantidad */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateQuantity(item.id, item.quantity - 1)}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600"
        >−</button>
        <span className="w-8 text-center font-semibold">{item.quantity}</span>
        <button
          onClick={() => updateQuantity(item.id, item.quantity + 1)}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600"
        >+</button>
      </div>

      {/* Subtotal */}
      <div className="text-right min-w-[100px]">
        <p className="font-bold text-gray-800">{fmtARS(item.price * item.quantity)}</p>
      </div>

      <button
        onClick={() => removeFromCart(item.id)}
        className="text-red-400 hover:text-red-600 transition-colors text-lg"
      >✕</button>
    </div>
  );
}
