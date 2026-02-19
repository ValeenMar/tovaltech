import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import CartItem from '../../components/store/CartItem';

export default function Cart() {
  const { cartItems, cartTotal, clearCart, cartCount } = useCart();

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <span className="text-8xl mb-6 block">🛒</span>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Tu carrito está vacío</h1>
        <p className="text-gray-500 mb-8">Agregá productos para comenzar tu compra</p>
        <Link to="/productos" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700">Ver Productos</Link>
      </div>
    );
  }

  const shipping = cartTotal >= 50 ? 0 : 4.99;
  const tax = cartTotal * 0.13;
  const total = cartTotal + shipping + tax;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Carrito de Compras</h1>
          <p className="text-gray-500 mt-1">{cartCount} artículo{cartCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={clearCart} className="text-red-500 hover:text-red-700 text-sm font-medium">🗑️ Vaciar carrito</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {cartItems.map(item => <CartItem key={item.id} item={item} />)}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 h-fit sticky top-24">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Resumen del Pedido</h2>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal ({cartCount} artículos)</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Envío</span>
              <span className={shipping === 0 ? 'text-green-600 font-medium' : ''}>{shipping === 0 ? 'Gratis' : `$${shipping}`}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Impuesto (13%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <hr />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-blue-600">${total.toFixed(2)}</span>
            </div>
          </div>
          {cartTotal < 50 && (
            <p className="text-xs text-orange-500 mb-4 bg-orange-50 p-2 rounded">💡 Agregá ${(50 - cartTotal).toFixed(2)} más para envío gratis</p>
          )}
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Proceder al Pago</button>
          <Link to="/productos" className="block text-center text-blue-600 text-sm mt-4 hover:underline">← Seguir comprando</Link>
        </div>
      </div>
    </div>
  );
}