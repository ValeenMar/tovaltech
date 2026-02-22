const { randomUUID, createHash } = require('crypto');
const sql = require('mssql');

const connectDB = require('../db');
const { calculateShipping, normalizeZone } = require('../_shared/shipping');
const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');

const QUOTE_TTL_MIN = Number.parseInt(process.env.CHECKOUT_QUOTE_TTL_MIN || '20', 10);

function toPositiveInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildItemsMap(rawItems) {
  const map = new Map();
  for (const row of rawItems || []) {
    const id = toPositiveInt(row?.id);
    const quantity = toPositiveInt(row?.quantity, 1);
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + quantity);
  }
  return map;
}

function buildInClause(ids) {
  return ids.map((_, i) => `@id${i}`).join(', ');
}

module.exports = async function (context, req) {
  const traceId = getTraceId(req);

  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: {
        'x-trace-id': traceId,
      },
    };
    return;
  }

  if (req.method !== 'POST') {
    sendJson(context, {
      status: 405,
      traceId,
      body: { error: 'method_not_allowed', trace_id: traceId },
    });
    return;
  }

  try {
    const itemsMap = buildItemsMap(req.body?.items);
    const zone = normalizeZone(req.body?.shipping?.zone);

    if (!itemsMap.size) {
      sendJson(context, {
        status: 400,
        traceId,
        body: { error: 'items_required', trace_id: traceId },
      });
      return;
    }

    const pool = await connectDB();
    const ids = [...itemsMap.keys()];
    const inClause = buildInClause(ids);

    const sqlReq = pool.request();
    ids.forEach((id, idx) => sqlReq.input(`id${idx}`, sql.Int, id));

    const dbRes = await sqlReq.query(`
      SELECT id, name, category, price_ars, stock, active
      FROM dbo.tovaltech_products
      WHERE id IN (${inClause})
    `);

    const productsById = new Map((dbRes.recordset || []).map((p) => [p.id, p]));
    const pricedItems = [];

    for (const [id, quantity] of itemsMap.entries()) {
      const product = productsById.get(id);
      if (!product) {
        sendJson(context, {
          status: 404,
          traceId,
          body: { error: 'product_not_found', product_id: id, trace_id: traceId },
        });
        return;
      }

      if (product.active === 0) {
        sendJson(context, {
          status: 400,
          traceId,
          body: { error: 'product_inactive', product_id: id, trace_id: traceId },
        });
        return;
      }

      if ((product.stock ?? 0) < quantity) {
        sendJson(context, {
          status: 400,
          traceId,
          body: {
            error: 'insufficient_stock',
            product_id: id,
            available: product.stock ?? 0,
            requested: quantity,
            trace_id: traceId,
          },
        });
        return;
      }

      pricedItems.push({
        id: String(product.id),
        title: String(product.name || '').slice(0, 256),
        category: product.category,
        quantity,
        unit_price: Math.round(Number(product.price_ars) || 0),
        currency_id: 'ARS',
      });
    }

    const shipping = calculateShipping(pricedItems, zone);
    if (!shipping.canShip) {
      sendJson(context, {
        status: 400,
        traceId,
        body: {
          error: 'cannot_ship',
          reason: shipping.reason,
          trace_id: traceId,
        },
      });
      return;
    }

    const subtotal = shipping.subtotal_ars;
    const total = subtotal + shipping.cost;
    const quoteId = randomUUID();
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MIN * 60 * 1000);

    const payload = {
      currency: 'ARS',
      items: pricedItems,
      shipping: {
        zone,
        cost: shipping.cost,
        free: shipping.free,
        tier: shipping.tier,
      },
      subtotal_ars: subtotal,
      total_ars: total,
    };

    const fingerprint = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    await pool.request()
      .input('quote_id', sql.NVarChar(64), quoteId)
      .input('payload_json', sql.NVarChar(sql.MAX), JSON.stringify(payload))
      .input('total_ars', sql.Int, total)
      .input('expires_at', sql.DateTime2, expiresAt)
      .input('request_fingerprint', sql.NVarChar(128), fingerprint)
      .query(`
        INSERT INTO dbo.tovaltech_checkout_quotes
          (quote_id, payload_json, total_ars, expires_at, request_fingerprint, created_at)
        VALUES
          (@quote_id, @payload_json, @total_ars, @expires_at, @request_fingerprint, SYSUTCDATETIME())
      `);

    logWithTrace(context, 'info', traceId, 'checkout_quote_created', {
      quote_id: quoteId,
      items_count: pricedItems.length,
      total_ars: total,
      expires_at: expiresAt.toISOString(),
    });

    sendJson(context, {
      status: 200,
      traceId,
      body: {
        quote_id: quoteId,
        expires_at: expiresAt.toISOString(),
        currency: 'ARS',
        items: pricedItems,
        subtotal_ars: subtotal,
        shipping_ars: shipping.cost,
        total_ars: total,
      },
    });
  } catch (err) {
    logWithTrace(context, 'error', traceId, 'checkout_quote_failed', { error: err.message });
    sendJson(context, {
      status: 500,
      traceId,
      body: { error: 'checkout_quote_failed', trace_id: traceId },
    });
  }
};
