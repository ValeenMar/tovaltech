import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { getCartShipping, ZONES, FREE_SHIPPING_THRESHOLD } from '../../utils/shipping';

// ── Configuración ────────────────────────────────────────────────────────────
const WA_NUMBER = '5491123413674';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0);

// ── Helper: mensaje de WhatsApp ───────────────────────────────────────────────
function buildWAMessage(form, cartItems, shipping, total) {
  const lines = cartItems.map(
    (i) => `• ${i.name} x${i.quantity} → ${fmtARS(i.price * i.quantity)}`
  );
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const zoneName = ZONES.find((z) => z.value === form.zone)?.label ?? form.zone;

  return [
    '🛒 *Consulta de pedido — TovalTech*',
    '',
    `👤 *Cliente:* ${form.name} ${form.lastName}`,
    `📧 *Email:* ${form.email}`,
    `📱 *Teléfono:* ${form.phone}`,
    `📍 *Zona:* ${zoneName}`,
    form.address ? `🏠 *Dirección:* ${form.address}, ${form.city}` : '',
    '',
    '*Productos:*',
    ...lines,
    '',
    `Subtotal: ${fmtARS(subtotal)}`,
    shipping.free
      ? 'Envío: Gratis 🎉'
      : !shipping.canShip
      ? '⚠️ Envío: requiere cotización especial'
      : `Envío (${zoneName}): ${fmtARS(shipping.cost)}`,
    `*Total estimado: ${fmtARS(total)}*`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function Checkout() {
  const { cartItems, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name:     '',
    lastName: '',
    email:    '',
    phone:    '',
    zone:     'CABA',
    address:  '',
    city:     '',
  });

  const [mpLoading, setMpLoading] = useState(false);
  const [mpError,   setMpError]   = useState(null);

  const shipping = useMemo(
    () => getCartShipping(cartItems, form.zone),
    [cartItems, form.zone]
  );

  const total = cartTotal + (shipping.canShip ? shipping.cost : 0);

  const remaining = FREE_SHIPPING_THRESHOLD - cartTotal;

  const isFormValid = form.name && form.lastName && form.email && form.phone && form.zone;

  // Redirect si el carrito está vacío
  if (!cartItems.length) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <span className="text-8xl mb-6 block">🛒</span>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Tu carrito está vacío</h1>
        <Link to="/productos" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700">
          Ver Productos
        </Link>
      </div>
    );
  }

  // ── Pagar con Mercado Pago ──────────────────────────────────────────────────
  const handleMercadoPago = async () => {
    if (!isFormValid) return;
    setMpLoading(true);
    setMpError(null);
    try {
      const res = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          buyer: form,
          items: cartItems.map((i) => ({
            id:          String(i.id),
            title:       i.name,
            quantity:    i.quantity,
            unit_price:  i.price,
            currency_id: 'ARS',
          })),
          shipping: shipping.canShip
            ? { cost: shipping.cost, zone: form.zone }
            : null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { init_point } = await res.json();
      window.location.href = init_point;
    } catch (err) {
      setMpError('No se pudo conectar con Mercado Pago. Probá con WhatsApp.');
      setMpLoading(false);
    }
  };

  // ── Consultar por WhatsApp ──────────────────────────────────────────────────
  const handleWhatsApp = () => {
    const msg = buildWAMessage(form, cartItems, shipping, total);
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link to="/carrito" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
          ← Volver al carrito
        </Link>
        <h1 className="text-3xl font-bold text-gray-800">Finalizar compra</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Formulario ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Datos personales */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">👤 Tus datos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Nombre *</label>
                <input
                  value={form.name} onChange={set('name')}
                  placeholder="Juan"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Apellido *</label>
                <input
                  value={form.lastName} onChange={set('lastName')}
                  placeholder="García"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email *</label>
                <input
                  type="email" value={form.email} onChange={set('email')}
                  placeholder="juan@email.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Teléfono *</label>
                <input
                  type="tel" value={form.phone} onChange={set('phone')}
                  placeholder="+54 9 11 1234-5678"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Zona de envío */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">🚚 Zona de envío</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {ZONES.map((z) => (
                <button
                  key={z.value}
                  onClick={() => setForm((f) => ({ ...f, zone: z.value }))}
                  className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all
                    ${form.zone === z.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                >
                  {z.label}
                </button>
              ))}
            </div>

            {/* Costo de envío calculado */}
            {!shipping.canShip ? (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
                ⚠️ {shipping.reason}
                <p className="mt-1 text-xs text-orange-500">Usá WhatsApp para coordinar el envío.</p>
              </div>
            ) : shipping.free ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                🎉 ¡Envío gratis para tu zona!
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
                Envío estimado a {ZONES.find(z => z.value === form.zone)?.label}:{' '}
                <span className="font-bold text-gray-800">{fmtARS(shipping.cost)}</span>
                {remaining > 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    💡 Agregá {fmtARS(remaining)} más al carrito para envío gratis
                  </p>
                )}
              </div>
            )}

            {/* Dirección (opcional pero recomendada) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Dirección <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  value={form.address} onChange={set('address')}
                  placeholder="Av. Corrientes 1234, Piso 3"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Ciudad</label>
                <input
                  value={form.city} onChange={set('city')}
                  placeholder="Buenos Aires"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Resumen del pedido ────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Resumen</h2>

            {/* Items */}
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm gap-2">
                  <span className="text-gray-600 truncate flex-1">
                    {item.emoji ?? '📦'} {item.name}
                    <span className="text-gray-400 ml-1">×{item.quantity}</span>
                  </span>
                  <span className="font-medium whitespace-nowrap">{fmtARS(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{fmtARS(cartTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Envío</span>
                <span className={shipping.free ? 'text-green-600 font-medium' : ''}>
                  {!shipping.canShip
                    ? <span className="text-orange-500">A cotizar</span>
                    : shipping.free
                    ? 'Gratis 🎉'
                    : fmtARS(shipping.cost)}
                </span>
              </div>
              <hr />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="text-blue-600">{fmtARS(total)}</span>
              </div>
            </div>

            {/* Error MP */}
            {mpError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                {mpError}
              </div>
            )}

            {/* CTAs */}
            <div className="mt-5 space-y-3">
              {/* Mercado Pago */}
              <button
                onClick={handleMercadoPago}
                disabled={!isFormValid || mpLoading || !shipping.canShip}
                className="w-full flex items-center justify-center gap-2 bg-[#009ee3] text-white py-3 rounded-xl
                           font-semibold hover:bg-[#0087c2] transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mpLoading ? (
                  <span className="animate-spin text-lg">⟳</span>
                ) : (
                  <>
                    <img
                      src="https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/6.8.0/mercadopago/logo__large@2x.png"
                      alt="Mercado Pago"
                      className="h-5 object-contain brightness-0 invert"
                      onError={e => e.target.style.display='none'}
                    />
                    Pagar con Mercado Pago
                  </>
                )}
              </button>

              {/* WhatsApp */}
              <button
                onClick={handleWhatsApp}
                disabled={!isFormValid}
                className="w-full flex items-center justify-center gap-2 bg-[#25d366] text-white py-3 rounded-xl
                           font-semibold hover:bg-[#1fbb59] transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Consultar por WhatsApp
              </button>

              {!isFormValid && (
                <p className="text-xs text-center text-gray-400">Completá los datos requeridos (*)</p>
              )}

              {!shipping.canShip && isFormValid && (
                <p className="text-xs text-center text-orange-500">
                  Este pedido necesita coordinar el envío por WhatsApp
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}