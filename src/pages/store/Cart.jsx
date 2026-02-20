import { Link } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import { useCart } from '../../context/CartContext';
import CartItem from '../../components/store/CartItem';
import { FREE_SHIPPING_THRESHOLD } from '../../utils/shipping';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0);

export default function Cart() {
  const { cartItems, cartTotal, clearCart, cartCount } = useCart();
  useSEO({ title: "Carrito de compras" });

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <span className="text-8xl mb-6 block">🛒</span>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Tu carrito está vacío</h1>
        <p className="text-gray-500 mb-8">Agregá productos para comenzar tu compra</p>
        <Link to="/productos" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700">
          Ver Productos
        </Link>
      </div>
    );
  }

  const remaining = FREE_SHIPPING_THRESHOLD - cartTotal;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Carrito de Compras</h1>
          <p className="text-gray-500 mt-1">{cartCount} artículo{cartCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={clearCart} className="text-red-500 hover:text-red-700 text-sm font-medium">
          🗑️ Vaciar carrito
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {cartItems.map(item => <CartItem key={item.id} item={item} />)}
        </div>

        {/* Resumen */}
        <div className="bg-white rounded-xl shadow-sm p-6 h-fit sticky top-24">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Resumen del Pedido</h2>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal ({cartCount} artículo{cartCount !== 1 ? 's' : ''})</span>
              <span className="font-medium">{fmtARS(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Envío</span>
              <span className="text-gray-400 italic text-xs mt-0.5">Se calcula al finalizar</span>
            </div>
            <hr />
            <div className="flex justify-between text-lg font-bold">
              <span>Subtotal</span>
              <span className="text-blue-600">{fmtARS(cartTotal)}</span>
            </div>
          </div>

          {remaining > 0 ? (
            <p className="text-xs text-orange-500 mb-4 bg-orange-50 p-2 rounded">
              💡 Agregá {fmtARS(remaining)} más para envío gratis en accesorios y periféricos
            </p>
          ) : (
            <p className="text-xs text-green-600 mb-4 bg-green-50 p-2 rounded">
              🎉 ¡Superaste el umbral para envío gratis en accesorios y periféricos!
            </p>
          )}

          <Link
            to="/checkout"
            className="block w-full text-center bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Finalizar compra →
          </Link>
          <Link to="/productos" className="block text-center text-blue-600 text-sm mt-4 hover:underline">
            ← Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  );
}