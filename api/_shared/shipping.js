const FREE_SHIPPING_THRESHOLD = 50000;

const ZONE_COSTS = {
  CABA: { small: 2990, medium: 4990, large: 9990 },
  GBA: { small: 3990, medium: 6990, large: 12990 },
  interior: { small: 5990, medium: 9990, large: 18990 },
};

const TIER_ORDER = ['small', 'medium', 'large'];

const NO_SHIP_PATTERNS = [
  /SERVIDOR/i,
  /DESKTOP/i,
  /GABINETE/i,
  /RACK/i,
];

const LARGE_PATTERNS = [
  /MONITOR/i,
  /PANTALLA/i,
  /TABLET/i,
  /IMPRESORA/i,
  /NOTEBOOK/i,
  /ALL[\s-]?IN[\s-]?ONE/i,
];

const MEDIUM_PATTERNS = [
  /AUDIO/i,
  /PERIFER/i,
  /VIDEO/i,
  /GPU/i,
  /PLACA DE VIDEO/i,
  /PROCESADOR/i,
  /MOTHER/i,
  /FUENTE/i,
];

function normalizeCategory(category) {
  return String(category || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function normalizeZone(zone) {
  const raw = String(zone || '').trim();
  if (raw === 'CABA') return 'CABA';
  if (raw === 'GBA') return 'GBA';
  return 'interior';
}

function categoryTier(category) {
  const normalized = normalizeCategory(category);
  if (NO_SHIP_PATTERNS.some((rx) => rx.test(normalized))) return 'noship';
  if (LARGE_PATTERNS.some((rx) => rx.test(normalized))) return 'large';
  if (MEDIUM_PATTERNS.some((rx) => rx.test(normalized))) return 'medium';
  return 'small';
}

function calculateShipping(items, zone) {
  if (!Array.isArray(items) || !items.length) {
    return { canShip: false, cost: 0, tier: null, free: false, reason: 'cart_empty' };
  }

  let subtotal = 0;
  let maxTierIdx = 0;
  let noShipItem = null;

  for (const item of items) {
    const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
    const unitPrice = Math.max(0, Number(item.unit_price) || 0);
    subtotal += quantity * unitPrice;

    const tier = categoryTier(item.category);
    if (tier === 'noship') {
      noShipItem = item;
      break;
    }
    const idx = TIER_ORDER.indexOf(tier);
    if (idx > maxTierIdx) maxTierIdx = idx;
  }

  if (noShipItem) {
    return {
      canShip: false,
      cost: 0,
      tier: 'noship',
      free: false,
      reason: `"${noShipItem.name || 'Producto'}" requiere cotizacion especial.`,
      subtotal_ars: Math.round(subtotal),
    };
  }

  const tier = TIER_ORDER[maxTierIdx];
  const normalizedZone = normalizeZone(zone);

  if (subtotal >= FREE_SHIPPING_THRESHOLD && tier !== 'large') {
    return {
      canShip: true,
      cost: 0,
      tier,
      free: true,
      zone: normalizedZone,
      subtotal_ars: Math.round(subtotal),
    };
  }

  const costs = ZONE_COSTS[normalizedZone] || ZONE_COSTS.interior;
  return {
    canShip: true,
    cost: costs[tier],
    tier,
    free: false,
    zone: normalizedZone,
    subtotal_ars: Math.round(subtotal),
  };
}

module.exports = {
  FREE_SHIPPING_THRESHOLD,
  normalizeZone,
  calculateShipping,
};
