/**
 * shipping.js — Lógica de tarifas de envío
 *
 * Tier por categoría:
 *   noship  → No se puede enviar (Servidores, Desktops, Gabinetes)
 *   small   → Accesorios pequeños, Almacenamiento (~0.5 kg)
 *   medium  → Audio, Periféricos, Video (~1-2 kg)
 *   large   → Computadoras, Monitores/Pantallas, Tablets (~3-6 kg)
 *
 * Zonas: CABA | GBA | interior
 * Envío gratis: subtotal >= $50.000 en tier small o medium
 */

export const NO_SHIP_CATEGORIES = new Set([
  'Servidores',
  'Desktops',
  'Gabinetes',
  'Rack',
]);

const CATEGORY_TIER = {
  Accesorios:    'small',
  Almacenamiento:'small',
  Audio:         'medium',
  Periféricos:   'medium',
  Video:         'medium',
  Computadoras:  'large',
  Pantallas:     'large',
  Monitores:     'large',
  Tablets:       'large',
  Impresoras:    'large',
};

const TIER_ORDER = ['small', 'medium', 'large'];

// Tarifas en ARS
const SHIPPING_COSTS = {
  CABA:     { small: 2_990,  medium: 4_990,  large: 9_990  },
  GBA:      { small: 3_990,  medium: 6_990,  large: 12_990 },
  interior: { small: 5_990,  medium: 9_990,  large: 18_990 },
};

export const FREE_SHIPPING_THRESHOLD = 50_000;

export const ZONES = [
  { value: 'CABA',     label: 'CABA' },
  { value: 'GBA',      label: 'Gran Buenos Aires' },
  { value: 'interior', label: 'Interior del país' },
];

/**
 * @param {Array}  cartItems — items del carrito (deben tener .category, .price, .quantity)
 * @param {string} zone      — 'CABA' | 'GBA' | 'interior'
 * @returns {{ canShip, cost, tier, free, reason }}
 */
export function getCartShipping(cartItems, zone) {
  if (!cartItems.length) return { canShip: false, cost: 0, tier: null, free: false, reason: '' };

  // Si algún ítem no se puede enviar normalmente → cotización especial
  const noShipItem = cartItems.find(i => NO_SHIP_CATEGORIES.has(i.category));
  if (noShipItem) {
    return {
      canShip: false,
      cost: 0,
      tier: 'noship',
      free: false,
      reason: `"${noShipItem.name}" requiere cotización de flete especial.`,
    };
  }

  // Tier más alto del carrito
  let maxIdx = 0;
  for (const item of cartItems) {
    const tier = CATEGORY_TIER[item.category] ?? 'small';
    const idx  = TIER_ORDER.indexOf(tier);
    if (idx > maxIdx) maxIdx = idx;
  }
  const tier = TIER_ORDER[maxIdx];

  // Envío gratis solo para small/medium y si supera el umbral
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  if (cartTotal >= FREE_SHIPPING_THRESHOLD && tier !== 'large') {
    return { canShip: true, cost: 0, tier, free: true, reason: '' };
  }

  const costs = SHIPPING_COSTS[zone] ?? SHIPPING_COSTS.interior;
  return { canShip: true, cost: costs[tier], tier, free: false, reason: '' };
}

export function tierLabel(tier) {
  return { small: 'Paquete pequeño', medium: 'Paquete mediano', large: 'Paquete grande' }[tier] ?? '';
}
