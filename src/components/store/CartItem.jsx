import { useCart } from '../../context/CartContext';

export default function CartItem({ item }) {
  const { updateQuantity, removeFromCart } = useCart();

  return (
    <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
      <div className="bg-gray-50 w-20 h-20 rounded-lg flex items-center justify-center text-4xl flex-shrink-0">{item.image}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800 truncate">{item.name}</h3>
        <p className="text-sm text-gray-500">{item.category}</p>
        <p className="text-blue-600 font-bold mt-1">${item.price.toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600">−</button>
        <span className="w-8 text-center font-semibold">{item.quantity}</span>
        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600">+</button>
      </div>
      <div className="text-right min-w-[80px]">
        <p className="font-bold text-gray-800">${(item.price * item.quantity).toFixed(2)}</p>
      </div>
      <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 transition-colors text-lg">✕</button>
    </div>
  );
}