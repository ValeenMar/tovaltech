/**
 * api/create-preference/index.js
 *
 * Crea una preferencia de pago en Mercado Pago desde un quote server-side.
 *
 * Variables de entorno:
 *   MP_ACCESS_TOKEN, APP_URL
 */

const sql = require('mssql');
const connectDB = require('../db');
const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');
const { validateBuyer } = require('../_shared/buyer');
const { takeRateLimit } = require('../_shared/rate-limit');
const { releaseQuoteStock, releaseExpiredQuotes } = require('../_shared/quote-stock');

const MP_API = 'https://api.mercadopago.com/checkout/preferences';
const CREATE_PREF_WINDOW_MS = Number.parseInt(process.env.CREATE_PREFERENCE_WINDOW_MS || '60000', 10);
const CREATE_PREF_LIMIT = Number.parseInt(process.env.CREATE_PREFERENCE_RATE_LIMIT || '8', 10);

function getClientIp(req) {
  const xff = String(req.headers?.['x-forwarded-for'] || '').trim();
  if (xff) return xff.split(',')[0].trim();
  const xrip = String(req.headers?.['x-real-ip'] || '').trim();
  if (xrip) return xrip;
  const xc = String(req.headers?.['x-client-ip'] || '').trim();
  if (xc) return xc;
  return 'unknown';
}

module.exports = async function (context, req) {
  const traceId = getTraceId(req);

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: { 'x-trace-id': traceId } };
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

  const token = process.env.MP_ACCESS_TOKEN;
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  if (!token) {
    sendJson(context, {
      status: 500,
      traceId,
      body: { error: 'config_missing', message: 'MP_ACCESS_TOKEN no configurado.', trace_id: traceId },
    });
    return;
  }

  const quoteId = String(req.body?.quote_id || '').trim();
  const buyerValidation = validateBuyer(req.body?.buyer || null);
  const buyer = buyerValidation.buyer;

  if (!quoteId || !buyerValidation.ok) {
    logWithTrace(context, 'warn', traceId, 'create_preference_bad_request', {
      quote_id_present: Boolean(quoteId),
      reason: !quoteId ? 'quote_id_required' : buyerValidation.error,
    });
    sendJson(context, {
      status: 400,
      traceId,
      body: {
        error: 'bad_request',
        reason: !quoteId ? 'quote_id_required' : buyerValidation.error,
        trace_id: traceId,
      },
    });
    return;
  }

  const clientIp = getClientIp(req);
  const bucket = `create-pref:${clientIp}`;
  const rateLimit = takeRateLimit({
    bucket,
    limit: CREATE_PREF_LIMIT,
    windowMs: CREATE_PREF_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    logWithTrace(context, 'warn', traceId, 'create_preference_rate_limited', {
      client_ip: clientIp,
      retry_after_ms: rateLimit.retry_after_ms,
    });
    sendJson(context, {
      status: 429,
      traceId,
      headers: {
        'retry-after': String(Math.max(1, Math.ceil((rateLimit.retry_after_ms || 0) / 1000))),
      },
      body: {
        error: 'rate_limited',
        trace_id: traceId,
      },
    });
    return;
  }

  try {
    const pool = await connectDB();
    try {
      await releaseExpiredQuotes(pool, 20);
    } catch (cleanupErr) {
      logWithTrace(context, 'warn', traceId, 'create_preference_release_expired_failed', {
        error: cleanupErr.message,
      });
    }

    const quoteRes = await pool.request()
      .input('quote_id', sql.NVarChar(64), quoteId)
      .query(`
        SELECT quote_id, expires_at, used_at, released_at, released_reason
        FROM dbo.tovaltech_checkout_quotes
        WHERE quote_id = @quote_id
      `);

    if (!quoteRes.recordset.length) {
      sendJson(context, {
        status: 404,
        traceId,
        body: { error: 'quote_not_found', trace_id: traceId },
      });
      return;
    }

    const quote = quoteRes.recordset[0];
    if (quote.released_at) {
      sendJson(context, {
        status: 409,
        traceId,
        body: {
          error: 'quote_unavailable',
          reason: quote.released_reason || 'released',
          trace_id: traceId,
        },
      });
      return;
    }

    if (quote.used_at) {
      logWithTrace(context, 'warn', traceId, 'create_preference_quote_used', { quote_id: quoteId });
      sendJson(context, {
        status: 409,
        traceId,
        body: { error: 'quote_already_used', trace_id: traceId },
      });
      return;
    }

    if (new Date(quote.expires_at).getTime() < Date.now()) {
      await releaseQuoteStock(pool, quoteId, 'expired', { requireUnused: true, requireExpired: true });
      logWithTrace(context, 'warn', traceId, 'create_preference_quote_expired', { quote_id: quoteId });
      sendJson(context, {
        status: 410,
        traceId,
        body: { error: 'quote_expired', trace_id: traceId },
      });
      return;
    }

    const reserveRes = await pool.request()
      .input('quote_id', sql.NVarChar(64), quoteId)
      .query(`
        UPDATE dbo.tovaltech_checkout_quotes
        SET used_at = SYSUTCDATETIME()
        OUTPUT INSERTED.payload_json
        WHERE quote_id = @quote_id
          AND used_at IS NULL
          AND released_at IS NULL
          AND expires_at >= SYSUTCDATETIME()
      `);
    if (!reserveRes.recordset.length) {
      sendJson(context, {
        status: 409,
        traceId,
        body: { error: 'quote_already_used', trace_id: traceId },
      });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(reserveRes.recordset[0].payload_json);
    } catch {
      await releaseQuoteStock(pool, quoteId, 'invalid_payload');
      sendJson(context, {
        status: 500,
        traceId,
        body: { error: 'quote_payload_invalid', trace_id: traceId },
      });
      return;
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) {
      await releaseQuoteStock(pool, quoteId, 'invalid_payload');
      sendJson(context, {
        status: 400,
        traceId,
        body: { error: 'quote_items_missing', trace_id: traceId },
      });
      return;
    }

    const mpItems = items.map((i) => ({
      id: String(i.id),
      title: String(i.title || '').slice(0, 256),
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      currency_id: 'ARS',
    }));

    if ((payload?.shipping?.cost || 0) > 0) {
      const zoneNames = { CABA: 'CABA', GBA: 'Gran Buenos Aires', interior: 'Interior' };
      mpItems.push({
        id: 'shipping',
        title: `Envio - ${zoneNames[payload.shipping.zone] ?? payload.shipping.zone ?? 'General'}`,
        quantity: 1,
        unit_price: Number(payload.shipping.cost),
        currency_id: 'ARS',
      });
    }

    const preference = {
      items: mpItems,
      payer: {
        name: buyer.name,
        surname: buyer.lastName,
        email: buyer.email,
        phone: { area_code: '', number: buyer.phone },
        address: { street_name: buyer.address || '', zip_code: '' },
      },
      back_urls: {
        success: `${appUrl}/checkout/resultado?status=success`,
        failure: `${appUrl}/checkout/resultado?status=failure`,
        pending: `${appUrl}/checkout/resultado?status=pending`,
      },
      auto_return: 'approved',
      statement_descriptor: 'TovalTech',
      notification_url: `${appUrl}/api/mp-webhook`,
      metadata: {
        quote_id: quoteId,
        buyer_zone: String(payload?.shipping?.zone || ''),
        buyer_name: buyer.name,
        buyer_lastname: buyer.lastName,
        buyer_city: buyer.city || '',
      },
      external_reference: quoteId,
    };

    let mpData;
    try {
      const mpRes = await fetch(MP_API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(preference),
      });

      mpData = await mpRes.json();
      if (!mpRes.ok) {
        throw new Error(mpData?.message || `mp_error_${mpRes.status}`);
      }
    } catch (mpErr) {
      await releaseQuoteStock(pool, quoteId, 'mp_error');

      logWithTrace(context, 'error', traceId, 'create_preference_mp_error', {
        quote_id: quoteId,
        error: mpErr.message,
      });
      sendJson(context, {
        status: 502,
        traceId,
        body: {
          error: 'mp_error',
          message: 'Error de Mercado Pago',
          trace_id: traceId,
        },
      });
      return;
    }

    await pool.request()
      .input('quote_id', sql.NVarChar(64), quoteId)
      .input('mp_preference_id', sql.NVarChar(80), String(mpData.id || ''))
      .query(`
        UPDATE dbo.tovaltech_checkout_quotes
        SET mp_preference_id = @mp_preference_id
        WHERE quote_id = @quote_id
      `);

    logWithTrace(context, 'info', traceId, 'create_preference_ok', {
      quote_id: quoteId,
      preference_id: mpData.id,
      buyer_email: buyer.email,
      client_ip: clientIp,
    });

    sendJson(context, {
      status: 200,
      traceId,
      body: {
        preference_id: mpData.id,
        init_point: mpData.init_point,
        sandbox_point: mpData.sandbox_init_point,
      },
    });
  } catch (err) {
    logWithTrace(context, 'error', traceId, 'create_preference_failed', { error: err.message });
    sendJson(context, {
      status: 502,
      traceId,
      body: { error: 'network_error', message: 'No se pudo conectar con Mercado Pago.', trace_id: traceId },
    });
  }
};
