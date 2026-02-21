/**
 * api/mp-webhook/index.js
 *
 * Recibe notificaciones de pago de MercadoPago (IPN / Webhooks).
 * Verifica la firma x-signature antes de procesar cualquier notificación.
 * Verifica el pago contra la API de MP y guarda el pedido en Azure SQL.
 *
 * Variables de entorno necesarias:
 *   MP_ACCESS_TOKEN   → Token de producción de MercadoPago
 *   MP_WEBHOOK_SECRET → Secret configurado en el panel de MP (Webhooks → secret)
 */

const connectDB  = require('../db');
const crypto     = require('crypto');

const MP_PAYMENTS_URL = 'https://api.mercadopago.com/v1/payments';

// ── Verificación de firma HMAC-SHA256 ────────────────────────────────────────
// MP envía en el header x-signature: ts=<timestamp>,v1=<hash>
// El mensaje a firmar es: "id:<dataId>;request-id:<x-request-id>;ts:<ts>;"
// Documentación: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
function verifyMpSignature(req, dataId, secret) {
  try {
    const xSignature  = req.headers['x-signature']  || '';
    const xRequestId  = req.headers['x-request-id'] || '';

    if (!xSignature || !secret) return false;

    // Parsear ts y v1 del header
    const parts = Object.fromEntries(
      xSignature.split(',').map(part => {
        const [k, v] = part.split('=');
        return [k.trim(), v?.trim()];
      })
    );

    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    // Construir el mensaje tal como lo especifica MP
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Calcular HMAC
    const expected = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    // Comparación en tiempo constante para evitar timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(v1,       'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

module.exports = async function (context, req) {
  const headers = { 'content-type': 'application/json' };
  const token   = process.env.MP_ACCESS_TOKEN;
  const secret  = process.env.MP_WEBHOOK_SECRET; // puede ser undefined si no está configurado

  // ── MP envía un GET de validación al activar el webhook ──────────────────
  if (req.method === 'GET') {
    context.res = { status: 200, headers, body: { ok: true } };
    return;
  }

  // ── Leer notificación ────────────────────────────────────────────────────
  const body   = req.body ?? {};
  const topic  = body.type ?? req.query.topic;
  const dataId = body.data?.id ?? req.query.id;

  context.log.info('mp_webhook_received', { topic, dataId });

  // Solo nos importan las notificaciones de pago
  if (topic !== 'payment' || !dataId) {
    context.res = { status: 200, headers, body: { ignored: true } };
    return;
  }

  // ── Verificar firma si el secret está configurado ────────────────────────
  // Si MP_WEBHOOK_SECRET no está en las env vars, se loguea un warning pero
  // se sigue procesando (retrocompatibilidad con deployments sin el secret).
  // Una vez que configures el secret en Azure, la validación se activa sola.
  if (secret) {
    const valid = verifyMpSignature(req, dataId, secret);
    if (!valid) {
      context.log.warn('mp_webhook_invalid_signature', { dataId });
      // Respondemos 200 para que MP no reintente — si la firma no matchea
      // es un request falso o un replay; no queremos procesarlo.
      context.res = { status: 200, headers, body: { error: 'invalid_signature' } };
      return;
    }
  } else {
    context.log.warn('mp_webhook_no_secret', {
      message: 'MP_WEBHOOK_SECRET no está configurado. Configuralo en Azure para habilitar la verificación de firma.',
    });
  }

  try {
    // ── Verificar el pago directamente con MP ────────────────────────────
    const mpRes = await fetch(`${MP_PAYMENTS_URL}/${dataId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!mpRes.ok) {
      context.log.error('mp_payment_fetch_failed', { status: mpRes.status, dataId });
      context.res = { status: 200, headers, body: { error: 'mp_fetch_failed' } };
      return;
    }

    const payment = await mpRes.json();
    context.log.info('mp_payment_verified', { id: payment.id, status: payment.status });

    // ── Solo guardar pagos aprobados o pendientes (ignorar rechazados) ────
    if (!['approved', 'pending', 'in_process'].includes(payment.status)) {
      context.res = { status: 200, headers, body: { ignored: true, mp_status: payment.status } };
      return;
    }

    // ── Extraer datos del comprador desde los metadatos de la preferencia ─
    const payer    = payment.payer ?? {};
    const metadata = payment.metadata ?? {};

    const buyerName     = payer.first_name    ?? metadata.buyer_name     ?? null;
    const buyerLastname = payer.last_name      ?? metadata.buyer_lastname ?? null;
    const buyerEmail    = payer.email          ?? null;
    const buyerPhone    = payer.phone?.number  ?? null;
    const buyerZone     = metadata.zone        ?? null;
    const buyerAddress  = payer.address?.street_name ?? null;
    const buyerCity     = metadata.city        ?? null;

    // Items: MP los guarda en additional_info
    const items     = payment.additional_info?.items ?? [];
    const itemsJson = JSON.stringify(items);

    const totalArs    = payment.transaction_amount ?? null;
    const shippingCost = null; // MP no separa el shipping del total

    // Estado interno según estado MP
    const statusMap = {
      approved:   'paid',
      pending:    'pending',
      in_process: 'pending',
    };
    const internalStatus = statusMap[payment.status] ?? 'pending';

    // ── Guardar en Azure SQL (upsert por mp_payment_id) ─────────────────
    const pool = await connectDB();

    await pool.request()
      .input('mp_payment_id',    payment.id ? String(payment.id) : String(dataId))
      .input('mp_preference_id', payment.order?.id ? String(payment.order.id) : null)
      .input('mp_status',        payment.status)
      .input('status',           internalStatus)
      .input('buyer_name',       buyerName)
      .input('buyer_lastname',   buyerLastname)
      .input('buyer_email',      buyerEmail)
      .input('buyer_phone',      buyerPhone)
      .input('buyer_zone',       buyerZone)
      .input('buyer_address',    buyerAddress)
      .input('buyer_city',       buyerCity)
      .input('items_json',       itemsJson)
      .input('total_ars',        totalArs)
      .input('shipping_cost',    shippingCost)
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

    context.log.info('order_saved', { mp_payment_id: dataId, status: internalStatus });

    context.res = {
      status: 200,
      headers,
      body: { success: true, mp_status: payment.status, internal_status: internalStatus },
    };

  } catch (err) {
    context.log.error('mp_webhook_error', err.message);
    // Devolvemos 200 siempre para que MP no reintente indefinidamente
    context.res = {
      status: 200,
      headers,
      body: { error: 'internal_error', message: err.message },
    };
  }
};
