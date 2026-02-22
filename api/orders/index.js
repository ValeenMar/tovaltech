/**
 * api/orders/index.js
 *
 * GET  /api/orders          → Lista pedidos con filtros
 * POST /api/orders          → Actualiza estado de un pedido
 *
 * Query params GET:
 *   status   → filtrar por estado (paid / pending / shipped / delivered / cancelled)
 *   limit    → items por página (default 50)
 *   offset   → paginación
 *
 * Body POST:
 *   { id, status }
 */

const connectDB = require('../db');
const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

module.exports = async function (context, req) {
  const traceId = getTraceId(req);

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

    // ── POST — actualizar estado ───────────────────────────────────────────
    if (req.method === 'POST') {
      const { id, status } = req.body ?? {};

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
