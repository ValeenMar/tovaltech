/**
 * api/mp-webhook/index.js
 *
 * Recibe notificaciones de pago de Mercado Pago.
 * Verifica firma x-signature, consulta el pago en MP y persiste el pedido.
 * Si el pago termina en estado de rechazo/cancelación, libera la reserva de stock.
 */

const crypto = require('crypto');
const connectDB = require('../db');
const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');
const { releaseQuoteStock } = require('../_shared/quote-stock');

const MP_PAYMENTS_URL = 'https://api.mercadopago.com/v1/payments';
const ACTIVE_STATUSES = new Set(['approved', 'pending', 'in_process']);
const RELEASE_STATUSES = new Set(['rejected', 'cancelled', 'refunded', 'charged_back']);

function verifyMpSignature(req, dataId, secret) {
  try {
    const xSignature = req.headers['x-signature'] || '';
    const xRequestId = req.headers['x-request-id'] || '';
    if (!xSignature || !secret) return false;

    const parts = Object.fromEntries(
      xSignature.split(',').map((part) => {
        const [k, v] = part.split('=');
        return [k.trim(), v?.trim()];
      }),
    );

    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(v1, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

function getQuoteId(payment) {
  return String(
    payment?.external_reference
      || payment?.metadata?.quote_id
      || '',
  ).trim();
}

module.exports = async function (context, req) {
  const traceId = getTraceId(req);
  const token = process.env.MP_ACCESS_TOKEN;
  const secret = process.env.MP_WEBHOOK_SECRET;

  if (req.method === 'GET') {
    sendJson(context, {
      status: 200,
      traceId,
      body: { ok: true, trace_id: traceId },
    });
    return;
  }

  if (!token || !secret) {
    logWithTrace(context, 'error', traceId, 'mp_webhook_config_missing', {
      token: Boolean(token),
      secret: Boolean(secret),
    });
    sendJson(context, {
      status: 500,
      traceId,
      body: { error: 'config_missing', trace_id: traceId },
    });
    return;
  }

  const body = req.body || {};
  const topic = body.type || req.query.topic;
  const dataId = body.data?.id || req.query.id;
  logWithTrace(context, 'info', traceId, 'mp_webhook_received', { topic, data_id: dataId });

  if (topic !== 'payment' || !dataId) {
    sendJson(context, {
      status: 200,
      traceId,
      body: { ignored: true, trace_id: traceId },
    });
    return;
  }

  if (!verifyMpSignature(req, dataId, secret)) {
    logWithTrace(context, 'warn', traceId, 'mp_webhook_invalid_signature', { data_id: dataId });
    sendJson(context, {
      status: 200,
      traceId,
      body: { error: 'invalid_signature', trace_id: traceId },
    });
    return;
  }

  try {
    const mpRes = await fetch(`${MP_PAYMENTS_URL}/${dataId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!mpRes.ok) {
      logWithTrace(context, 'error', traceId, 'mp_payment_fetch_failed', {
        data_id: dataId,
        status: mpRes.status,
      });
      sendJson(context, {
        status: 200,
        traceId,
        body: { error: 'mp_fetch_failed', trace_id: traceId },
      });
      return;
    }

    const payment = await mpRes.json();
    const quoteId = getQuoteId(payment);
    logWithTrace(context, 'info', traceId, 'mp_payment_verified', {
      payment_id: payment.id,
      mp_status: payment.status,
      quote_id: quoteId || null,
    });

    if (RELEASE_STATUSES.has(payment.status) && quoteId) {
      const pool = await connectDB();
      const released = await releaseQuoteStock(pool, quoteId, `mp_${payment.status}`);
      logWithTrace(context, released.released ? 'info' : 'warn', traceId, 'mp_quote_release_attempt', {
        quote_id: quoteId,
        mp_status: payment.status,
        release_result: released.reason || 'released',
      });
    }

    if (!ACTIVE_STATUSES.has(payment.status)) {
      sendJson(context, {
        status: 200,
        traceId,
        body: { ignored: true, mp_status: payment.status, trace_id: traceId },
      });
      return;
    }

    const payer = payment.payer || {};
    const metadata = payment.metadata || {};

    const buyerName = payer.first_name || metadata.buyer_name || null;
    const buyerLastname = payer.last_name || metadata.buyer_lastname || null;
    const buyerEmail = payer.email || null;
    const buyerPhone = payer.phone?.number || null;
    const buyerZone = metadata.buyer_zone || metadata.zone || null;
    const buyerAddress = payer.address?.street_name || null;
    const buyerCity = metadata.buyer_city || metadata.city || null;

    const items = payment.additional_info?.items || [];
    const itemsJson = JSON.stringify(items);
    const totalArs = payment.transaction_amount || null;
    const shippingCost = null;

    const statusMap = {
      approved: 'paid',
      pending: 'pending',
      in_process: 'pending',
    };
    const internalStatus = statusMap[payment.status] || 'pending';

    const pool = await connectDB();
    await pool.request()
      .input('mp_payment_id', payment.id ? String(payment.id) : String(dataId))
      .input('mp_preference_id', payment.order?.id ? String(payment.order.id) : null)
      .input('mp_status', payment.status)
      .input('status', internalStatus)
      .input('buyer_name', buyerName)
      .input('buyer_lastname', buyerLastname)
      .input('buyer_email', buyerEmail)
      .input('buyer_phone', buyerPhone)
      .input('buyer_zone', buyerZone)
      .input('buyer_address', buyerAddress)
      .input('buyer_city', buyerCity)
      .input('items_json', itemsJson)
      .input('total_ars', totalArs)
      .input('shipping_cost', shippingCost)
      .input('raw_notification', JSON.stringify(payment).slice(0, 4000))
      .query(`
        MERGE dbo.tovaltech_orders AS t
        USING (SELECT @mp_payment_id AS mp_payment_id) AS s
          ON t.mp_payment_id = s.mp_payment_id
        WHEN MATCHED THEN
          UPDATE SET
            mp_status        = @mp_status,
            status           = @status,
            raw_notification = @raw_notification,
            updated_at       = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (
            mp_payment_id, mp_preference_id, mp_status, status,
            buyer_name, buyer_lastname, buyer_email, buyer_phone,
            buyer_zone, buyer_address, buyer_city,
            items_json, total_ars, shipping_cost, raw_notification,
            created_at, updated_at
          ) VALUES (
            @mp_payment_id, @mp_preference_id, @mp_status, @status,
            @buyer_name, @buyer_lastname, @buyer_email, @buyer_phone,
            @buyer_zone, @buyer_address, @buyer_city,
            @items_json, @total_ars, @shipping_cost, @raw_notification,
            GETDATE(), GETDATE()
          );
      `);

    logWithTrace(context, 'info', traceId, 'mp_order_saved', {
      payment_id: payment.id,
      internal_status: internalStatus,
      quote_id: quoteId || null,
    });

    sendJson(context, {
      status: 200,
      traceId,
      body: {
        success: true,
        mp_status: payment.status,
        internal_status: internalStatus,
        trace_id: traceId,
      },
    });
  } catch (err) {
    logWithTrace(context, 'error', traceId, 'mp_webhook_error', { error: err.message });
    sendJson(context, {
      status: 200,
      traceId,
      body: { error: 'internal_error', trace_id: traceId },
    });
  }
};
