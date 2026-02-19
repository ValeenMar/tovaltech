/**
 * create-preference/index.js
 *
 * Crea una preferencia de pago en Mercado Pago y devuelve el init_point.
 *
 * Variables de entorno necesarias en Azure:
 *   MP_ACCESS_TOKEN  → Token de producción de Mercado Pago
 *   APP_URL          → URL base del sitio (ej: https://tovaltech.com)
 *
 * Body esperado:
 *   { buyer, items: [{ id, title, quantity, unit_price }], shipping: { cost, zone } | null }
 */

// Node 18 tiene fetch nativo — no necesita node-fetch
const MP_API = 'https://api.mercadopago.com/checkout/preferences';

module.exports = async function (context, req) {
  // ── CORS para desarrollo local ──────────────────────────────────────────
  const headers = {
    'content-type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  // ── Validación ─────────────────────────────────────────────────────────
  const token  = process.env.MP_ACCESS_TOKEN;
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');

  if (!token) {
    context.log.error('MP_ACCESS_TOKEN no configurado');
    context.res = {
      status: 500,
      headers,
      body: { error: 'config_missing', message: 'MP_ACCESS_TOKEN no configurado en el servidor.' },
    };
    return;
  }

  const { buyer, items, shipping } = req.body ?? {};

  if (!buyer || !Array.isArray(items) || !items.length) {
    context.res = {
      status: 400,
      headers,
      body: { error: 'bad_request', message: 'Faltan buyer o items.' },
    };
    return;
  }

  // ── Armar ítems para MP ────────────────────────────────────────────────
  const mpItems = items.map((i) => ({
    id:          String(i.id),
    title:       String(i.title).slice(0, 256),
    quantity:    Number(i.quantity),
    unit_price:  Number(i.unit_price),
    currency_id: 'ARS',
  }));

  // Si hay costo de envío, lo agregamos como ítem extra
  if (shipping?.cost > 0) {
    const zoneNames = { CABA: 'CABA', GBA: 'Gran Buenos Aires', interior: 'Interior' };
    mpItems.push({
      id:          'shipping',
      title:       `Envío — ${zoneNames[shipping.zone] ?? shipping.zone}`,
      quantity:    1,
      unit_price:  Number(shipping.cost),
      currency_id: 'ARS',
    });
  }

  // ── Preferencia MP ────────────────────────────────────────────────────
  const preference = {
    items: mpItems,
    payer: {
      name:    buyer.name,
      surname: buyer.lastName,
      email:   buyer.email,
      phone:   { area_code: '', number: buyer.phone },
      address: {
        street_name:   buyer.address || '',
        zip_code:      '',
      },
    },
    back_urls: {
      success: `${appUrl}/checkout/resultado?status=success`,
      failure: `${appUrl}/checkout/resultado?status=failure`,
      pending: `${appUrl}/checkout/resultado?status=pending`,
    },
    auto_return:          'approved',
    statement_descriptor: 'TovalTech',
    // notification_url: `${appUrl}/api/mp-webhook`,  // ← Activar cuando implementes el webhook
  };

  // ── Llamada a MP ───────────────────────────────────────────────────────
  try {
    const res = await fetch(MP_API, {
      method:  'POST',
      headers: {
        'content-type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await res.json();

    if (!res.ok) {
      context.log.error('mp_error', data);
      context.res = {
        status: res.status,
        headers,
        body: { error: 'mp_error', message: data?.message ?? 'Error de Mercado Pago' },
      };
      return;
    }

    context.log.info('preference_created', { id: data.id, buyer: buyer.email });

    context.res = {
      status: 200,
      headers,
      body: {
        preference_id: data.id,
        init_point:    data.init_point,        // Producción
        sandbox_point: data.sandbox_init_point, // Pruebas
      },
    };
  } catch (err) {
    context.log.error('create_preference_failed', err.message);
    context.res = {
      status: 502,
      headers,
      body: { error: 'network_error', message: 'No se pudo conectar con Mercado Pago.' },
    };
  }
};
