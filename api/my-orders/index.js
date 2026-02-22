const connectDB = require('../db');
const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');
const { getTokenFromRequest, verifyToken } = require('../auth-utils');

const VALID_STATUSES = new Set(['pending', 'paid', 'shipped', 'delivered', 'cancelled']);

function parseItems(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = async function (context, req) {
  const traceId = getTraceId(req);

  if (req.method !== 'GET') {
    sendJson(context, {
      status: 405,
      traceId,
      body: { error: 'method_not_allowed', trace_id: traceId },
    });
    return;
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    sendJson(context, {
      status: 200,
      traceId,
      body: { ok: false, error: 'no_session', trace_id: traceId },
    });
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    sendJson(context, {
      status: 200,
      traceId,
      body: { ok: false, error: 'token_invalid', trace_id: traceId },
    });
    return;
  }

  const statusFilter = String(req.query?.status || '').trim();
  const status = VALID_STATUSES.has(statusFilter) ? statusFilter : '';
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit || '20', 10), 1), 100);
  const offset = Math.max(Number.parseInt(req.query?.offset || '0', 10), 0);

  try {
    const pool = await connectDB();

    const userRes = await pool.request()
      .input('id', payload.id)
      .query(`
        SELECT TOP 1 email
        FROM dbo.tovaltech_users
        WHERE id = @id
      `);

    const email = String(userRes.recordset?.[0]?.email || '').trim().toLowerCase();
    if (!email) {
      sendJson(context, {
        status: 200,
        traceId,
        body: { ok: false, error: 'user_not_found', trace_id: traceId },
      });
      return;
    }

    const tokenEmail = String(payload.email || '').trim().toLowerCase();
    const useTokenEmail = Boolean(tokenEmail && tokenEmail !== email);
    const where = `
      WHERE (
        LOWER(ISNULL(buyer_email, '')) = LOWER(@email)
        ${useTokenEmail ? "OR LOWER(ISNULL(buyer_email, '')) = LOWER(@token_email)" : ''}
      )
      ${status ? 'AND status = @status' : ''}
    `;

    const countReq = pool.request().input('email', email);
    if (useTokenEmail) countReq.input('token_email', tokenEmail);
    if (status) countReq.input('status', status);
    const countRes = await countReq.query(`
      SELECT COUNT(1) AS total
      FROM dbo.tovaltech_orders
      ${where}
    `);
    const total = countRes.recordset?.[0]?.total ?? 0;

    const rowsReq = pool.request()
      .input('email', email)
      .input('limit', limit)
      .input('offset', offset);
    if (useTokenEmail) rowsReq.input('token_email', tokenEmail);
    if (status) rowsReq.input('status', status);
    const rowsRes = await rowsReq.query(`
      SELECT
        id,
        mp_payment_id,
        mp_status,
        status,
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

    const orders = (rowsRes.recordset || []).map((row) => ({
      id: row.id,
      mp_payment_id: row.mp_payment_id,
      mp_status: row.mp_status,
      status: row.status,
      buyer_zone: row.buyer_zone,
      buyer_address: row.buyer_address,
      buyer_city: row.buyer_city,
      total_ars: Number(row.total_ars || 0),
      shipping_cost: row.shipping_cost == null ? null : Number(row.shipping_cost),
      created_at: row.created_at,
      updated_at: row.updated_at,
      items: parseItems(row.items_json),
    }));

    sendJson(context, {
      status: 200,
      traceId,
      body: {
        ok: true,
        orders,
        total,
        limit,
        offset,
        trace_id: traceId,
      },
    });
  } catch (err) {
    logWithTrace(context, 'error', traceId, 'my_orders_error', { error: err.message });
    sendJson(context, {
      status: 500,
      traceId,
      body: { error: 'internal_error', trace_id: traceId },
    });
  }
};
