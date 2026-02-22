/**
 * api/orders/index.js
 *
 * GET  /api/orders          → Lista pedidos con filtros
 * POST /api/orders          → Actualiza estado o simula una venta
 *
 * Query params GET:
 *   status   → filtrar por estado (paid / pending / shipped / delivered / cancelled)
 *   limit    → items por página (default 50)
 *   offset   → paginación
 *
 * Body POST:
 *   { id, status }                     // update status
 *   { action: "simulate_sale", ... }   // create mock order
 */

const connectDB = require('../db');
const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');
const { requireAdmin } = require('../_shared/require-admin');

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
const SIM_FIRST_NAMES = ['Valentina', 'Franco', 'Camila', 'Mateo', 'Sofia', 'Tomas', 'Lucia', 'Agustin'];
const SIM_LAST_NAMES = ['Gomez', 'Martinez', 'Rodriguez', 'Diaz', 'Sosa', 'Fernandez', 'Romero', 'Lopez'];
const SIM_ZONES = ['CABA', 'GBA', 'interior'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(arr, fallback = '') {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  return arr[randInt(0, arr.length - 1)];
}

function toMpStatus(status) {
  if (status === 'pending') return 'pending';
  if (status === 'cancelled') return 'cancelled';
  return 'approved';
}

async function buildSimulatedOrder(pool, requestedStatus = '') {
  const status = VALID_STATUSES.includes(requestedStatus) ? requestedStatus : 'paid';
  const mpStatus = toMpStatus(status);
  const firstName = pickOne(SIM_FIRST_NAMES, 'Cliente');
  const lastName = pickOne(SIM_LAST_NAMES, 'Demo');
  const zone = pickOne(SIM_ZONES, 'CABA');

  const productsRes = await pool.request().query(`
    SELECT TOP 6 id, name, price_ars, stock
    FROM dbo.tovaltech_products
    WHERE (active = 1 OR active IS NULL) AND stock > 0
    ORDER BY NEWID()
  `);

  const products = productsRes.recordset || [];
  const takeCount = Math.min(products.length || 1, randInt(1, 3));
  const picked = products.slice(0, takeCount);

  let items = picked.map((p) => {
    const quantity = Math.max(1, Math.min(randInt(1, 2), Number(p.stock || 1)));
    const unitPrice = Math.max(0, Number(p.price_ars || 0));
    return {
      id: String(p.id),
      title: String(p.name || `Producto ${p.id}`),
      quantity,
      unit_price: Math.round(unitPrice),
      currency_id: 'ARS',
    };
  });

  if (!items.length) {
    items = [{
      id: 'demo-item',
      title: 'Producto demo',
      quantity: 1,
      unit_price: 100000,
      currency_id: 'ARS',
    }];
  }

  const subtotal = items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
  const shippingCost = zone === 'CABA' ? 0 : zone === 'GBA' ? 3500 : 9000;
  const totalArs = subtotal + shippingCost;
  const paymentId = `SIM-${Date.now()}-${randInt(1000, 9999)}`;
  const prefId = `SIM-PREF-${Date.now()}-${randInt(10, 99)}`;
  const buyerEmail = `sim.${Date.now()}.${randInt(100, 999)}@example.test`;
  const buyerPhone = `11${randInt(20000000, 99999999)}`;
  const buyerAddress = zone === 'interior' ? 'Ruta Provincial 9' : 'Av. Corrientes 1234';
  const buyerCity = zone === 'interior' ? 'Cordoba' : 'Buenos Aires';

  if (shippingCost > 0) {
    items.push({
      id: 'shipping',
      title: `Envio - ${zone}`,
      quantity: 1,
      unit_price: shippingCost,
      currency_id: 'ARS',
    });
  }

  return {
    mp_payment_id: paymentId,
    mp_preference_id: prefId,
    mp_status: mpStatus,
    status,
    buyer_name: firstName,
    buyer_lastname: lastName,
    buyer_email: buyerEmail,
    buyer_phone: buyerPhone,
    buyer_zone: zone,
    buyer_address: buyerAddress,
    buyer_city: buyerCity,
    items_json: JSON.stringify(items),
    total_ars: Math.round(totalArs),
    shipping_cost: shippingCost,
    raw_notification: JSON.stringify({
      source: 'admin-sim',
      created_at: new Date().toISOString(),
      status,
      mp_status: mpStatus,
      items_count: items.length,
    }),
  };
}

module.exports = async function (context, req) {
  const traceId = getTraceId(req);
  const admin = requireAdmin(req);
  if (!admin.isAdmin) {
    sendJson(context, {
      status: 403,
      traceId,
      body: { error: 'forbidden', trace_id: traceId },
    });
    return;
  }

  try {
    const pool = await connectDB();

    // ── GET — listar pedidos ───────────────────────────────────────────────
    if (req.method === 'GET') {
      const status = (req.query.status || '').trim();
      const limit  = Math.min(Math.max(parseInt(req.query.limit  || '50', 10), 1), 200);
      const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

      const where    = status && VALID_STATUSES.includes(status) ? 'WHERE status = @status' : '';
      const countReq = pool.request();
      if (status) countReq.input('status', status);
      const countRes = await countReq.query(
        `SELECT COUNT(1) AS total FROM dbo.tovaltech_orders ${where}`
      );
      const total = countRes.recordset?.[0]?.total ?? 0;

      const itemsReq = pool.request();
      if (status) itemsReq.input('status', status);
      itemsReq.input('limit',  limit);
      itemsReq.input('offset', offset);

      const itemsRes = await itemsReq.query(`
        SELECT
          id,
          mp_payment_id,
          mp_status,
          status,
          buyer_name,
          buyer_lastname,
          buyer_email,
          buyer_phone,
          buyer_zone,
          buyer_address,
          buyer_city,
          items_json,
          total_ars,
          shipping_cost,
          created_at,
          updated_at
        FROM dbo.tovaltech_orders
        ${where}
        ORDER BY created_at DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

      // Parsear items_json de cada pedido
      const orders = (itemsRes.recordset || []).map(o => ({
        ...o,
        items: (() => {
          try { return JSON.parse(o.items_json || '[]'); }
          catch { return []; }
        })(),
        items_json: undefined,  // no mandar el string crudo al frontend
      }));

      sendJson(context, {
        status: 200,
        traceId,
        body: { orders, total, limit, offset, trace_id: traceId },
      });
      return;
    }

    // ── POST — actualizar estado / simular venta ──────────────────────────
    if (req.method === 'POST') {
      const body = req.body ?? {};
      const action = String(body.action || '').trim();

      if (action === 'simulate_sale') {
        const simulated = await buildSimulatedOrder(pool, body.status);
        const insertRes = await pool.request()
          .input('mp_payment_id', simulated.mp_payment_id)
          .input('mp_preference_id', simulated.mp_preference_id)
          .input('mp_status', simulated.mp_status)
          .input('status', simulated.status)
          .input('buyer_name', simulated.buyer_name)
          .input('buyer_lastname', simulated.buyer_lastname)
          .input('buyer_email', simulated.buyer_email)
          .input('buyer_phone', simulated.buyer_phone)
          .input('buyer_zone', simulated.buyer_zone)
          .input('buyer_address', simulated.buyer_address)
          .input('buyer_city', simulated.buyer_city)
          .input('items_json', simulated.items_json)
          .input('total_ars', simulated.total_ars)
          .input('shipping_cost', simulated.shipping_cost)
          .input('raw_notification', simulated.raw_notification)
          .query(`
            INSERT INTO dbo.tovaltech_orders (
              mp_payment_id, mp_preference_id, mp_status, status,
              buyer_name, buyer_lastname, buyer_email, buyer_phone,
              buyer_zone, buyer_address, buyer_city,
              items_json, total_ars, shipping_cost, raw_notification,
              created_at, updated_at
            )
            OUTPUT INSERTED.id
            VALUES (
              @mp_payment_id, @mp_preference_id, @mp_status, @status,
              @buyer_name, @buyer_lastname, @buyer_email, @buyer_phone,
              @buyer_zone, @buyer_address, @buyer_city,
              @items_json, @total_ars, @shipping_cost, @raw_notification,
              GETDATE(), GETDATE()
            )
          `);

        const insertedId = insertRes.recordset?.[0]?.id;
        logWithTrace(context, 'info', traceId, 'orders_simulated_sale_created', {
          id: insertedId,
          status: simulated.status,
          total_ars: simulated.total_ars,
        });

        sendJson(context, {
          status: 200,
          traceId,
          body: {
            success: true,
            simulated: true,
            id: insertedId,
            status: simulated.status,
            total_ars: simulated.total_ars,
            trace_id: traceId,
          },
        });
        return;
      }

      const { id, status } = body;

      if (!id || !status) {
        sendJson(context, {
          status: 400,
          traceId,
          body: { error: 'bad_request', message: 'Faltan id o status', trace_id: traceId },
        });
        return;
      }

      if (!VALID_STATUSES.includes(status)) {
        sendJson(context, {
          status: 400,
          traceId,
          body: {
            error: 'bad_request',
            message: `Status inválido. Válidos: ${VALID_STATUSES.join(', ')}`,
            trace_id: traceId,
          },
        });
        return;
      }

      await pool.request()
        .input('id',     parseInt(id, 10))
        .input('status', status)
        .query(`
          UPDATE dbo.tovaltech_orders
          SET status = @status, updated_at = GETDATE()
          WHERE id = @id
        `);

      sendJson(context, {
        status: 200,
        traceId,
        body: { success: true, id, status, trace_id: traceId },
      });
      return;
    }

    sendJson(context, {
      status: 405,
      traceId,
      body: { error: 'method_not_allowed', trace_id: traceId },
    });

  } catch (err) {
    logWithTrace(context, 'error', traceId, 'orders_error', { error: err.message });
    sendJson(context, {
      status: 500,
      traceId,
      body: { error: 'orders_failed', message: 'Error al procesar pedidos.', trace_id: traceId },
    });
  }
};
