import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

const STATES = {
  success: {
    icon:    '🎉',
    title:   '¡Pago confirmado!',
    desc:    'Tu pedido fue procesado correctamente. En breve te enviamos un email con los detalles.',
    color:   'text-green-600',
    bg:      'bg-green-50',
    border:  'border-green-200',
    badge:   'bg-green-100 text-green-700',
    badgeTxt:'Pago aprobado',
  },
  pending: {
    icon:    '⏳',
    title:   'Pago en proceso',
    desc:    'Tu pago está siendo verificado. Te notificaremos por email cuando se confirme.',
    color:   'text-yellow-600',
    bg:      'bg-yellow-50',
    border:  'border-yellow-200',
    badge:   'bg-yellow-100 text-yellow-700',
    badgeTxt:'Pendiente de acreditación',
  },
  failure: {
    icon:    '❌',
    title:   'El pago no se pudo completar',
    desc:    'Hubo un problema al procesar tu pago. Podés intentarlo nuevamente o consultarnos por WhatsApp.',
    color:   'text-red-600',
    bg:      'bg-red-50',
    border:  'border-red-200',
    badge:   'bg-red-100 text-red-700',
    badgeTxt:'Pago rechazado',
  },
};

export default function CheckoutResultado() {
  const [params] = useSearchParams();
  const { clearCart } = useCart();

  const status      = params.get('status') ?? 'failure';
  const paymentId   = params.get('payment_id');
  const merchantId  = params.get('merchant_order_id');
  const config      = STATES[status] ?? STATES.failure;

  // Limpiar carrito si el pago fue exitoso o está pendiente
  useEffect(() => {
    if (status === 'success' || status === 'pending') {
      clearCart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">

      {/* Ícono principal */}
      <div className={`w-24 h-24 rounded-full ${config.bg} border-2 ${config.border} flex items-center justify-center mx-auto mb-6`}>
        <span className="text-5xl">{config.icon}</span>
      </div>

      {/* Badge de estado */}
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${config.badge}`}>
        {config.badgeTxt}
      </span>

      {/* Título y descripción */}
      <h1 className={`text-2xl font-bold mb-3 ${config.color}`}>{config.title}</h1>
      <p className="text-gray-500 mb-8 leading-relaxed">{config.desc}</p>

      {/* Datos del pago (si existen) */}
      {(paymentId || merchantId) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 mb-8 text-sm text-gray-600 text-left space-y-1">
          {paymentId  && <p><span className="font-medium text-gray-800">Nº de pago:</span> {paymentId}</p>}
          {merchantId && <p><span className="font-medium text-gray-800">Nº de orden:</span> {merchantId}</p>}
        </div>
      )}

      {/* CTAs según estado */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {status === 'failure' ? (
          <>
            <Link
              to="/checkout"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Volver al checkout
            </Link>
            <Link
              to="/contacto"
              className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Contactarnos
            </Link>
          </>
        ) : (
          <Link
            to="/productos"
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Seguir comprando
          </Link>
        )}
      </div>
    </div>
  );
}
