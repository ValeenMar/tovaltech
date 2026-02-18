// api/functions/orders.js
'use strict';

/**
 * TovalTech 2.0 — Order endpoints
 *
 * POST  /api/orders                    → crear pedido (sp_CreateOrder, idempotency)
 * GET   /api/orders                    → mis pedidos (CUSTOMER) o todos (SELLER/OPS/ADMIN)
 * GET   /api/orders/{id}               → detalle completo de un pedido
 * PATCH /api/orders/{id}/status        → cambiar estado (sp_ChangeOrderStatus) [SELLER/OPS/ADMIN]
 * GET   /api/orders/{id}/history       → historial de estados
 */

const { app }    = require('@azure/functions');
const { execSP, execQuery, sql } = require('../shared/db');
const { getFxRateOrThrow }       = require('../shared/fx');
const { requireAuth, isAuthError } = require('../shared/auth');
const {
  ok, created, badRequest, unauthorized, forbidden,
  notFound, serverError, paged, fromAuthError, resolveCorrelationId,
} = require('../shared/response');

// ─── POST /api/orders ─────────────────────────────────────────────────────────
app.http('ordersCreate', {
  methods:   ['POST'],
  authLevel: 'anonymous',
  route:     'orders',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };
    const correlationId = resolveCorrelationId(req);
    context.log(JSON.stringify({ level: 'info', message: 'POST /api/orders', correlationId }));

    try {
      let body;
      try { body = await request.json(); }
      catch { return badRequest('Body JSON inválido', req); }

      // Idempotency key del header
      const idempotencyKey = request.headers.get('Idempotency-Key') || null;

      // Validaciones básicas
      const errors = _validateOrderBody(body);
      if (errors.length) return badRequest(errors, req);

      // Auth opcional — si viene token, se usa; si no, es guest
      let customerId = null;
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader) {
        const authResult = await requireAuth(req, []);
        if (!isAuthError(authResult)) {
          // Buscar o crear customer en DB
          customerId = await _upsertCustomer(authResult.caller);
        }
      }

      // FX rate — OBLIGATORIO para crear pedido
      const fx = await getFxRateOrThrow();

      // Serializar items para el SP
      const itemsJson = JSON.stringify(
        body.items.map((i) => ({
          product_id: i.productId,
          offer_id:   i.offerId || null,
          qty:        i.qty,
        }))
      );

      const result = await execSP('sp_CreateOrder', [
        { name: 'customer_id',           type: sql.Int,            value: customerId },
        { name: 'guest_contact_json',    type: sql.NVarChar('max'),value: customerId ? null : JSON.stringify(body.contact) },
        { name: 'shipping_address_json', type: sql.NVarChar('max'),value: JSON.stringify(body.shippingAddress) },
        { name: 'fx_rate_snapshot',      type: sql.Decimal(14, 4), value: fx.rate },
        { name: 'fx_source',             type: sql.NVarChar(100),  value: fx.source },
        { name: 'fx_timestamp',          type: sql.DateTime2,      value: new Date(fx.retrievedAt) },
        { name: 'customer_notes',        type: sql.NVarChar(1000), value: body.notes || null },
        { name: 'channel',               type: sql.NVarChar(50),   value: body.channel || 'web' },
        { name: 'idempotency_key',       type: sql.NVarChar(200),  value: idempotencyKey },
        { name: 'items_json',            type: sql.NVarChar('max'),value: itemsJson },
        { name: 'correlation_id',        type: sql.NVarChar(100),  value: correlationId },
      ]);

      const order = result.recordset[0];
      if (!order) return serverError(new Error('SP did not return order row'), req);

      context.log(JSON.stringify({
        level:       'info',
        message:     'order created',
        orderNumber: order.order_number,
        totalUsd:    order.total_usd,
        correlationId,
      }));

      return created({
        id:           order.public_id,
        orderNumber:  order.order_number,
        status:       order.status,
        totalUsd:     parseFloat(order.total_usd),
        totalArs:     parseFloat(order.total_ars),
        fx: {
          rate:        parseFloat(order.fx_rate_snapshot),
          source:      order.fx_source,
          retrievedAt: order.fx_timestamp,
        },
        createdAt:    order.created_at,
      }, req);
    } catch (err) {
      // SP puede tirar errores de negocio (50010 = sin offers activas)
      if (err.number === 50010) {
        return badRequest('No se encontraron precios activos para uno o más productos', req);
      }
      context.log(JSON.stringify({ level: 'error', message: 'ordersCreate error', error: err.message, correlationId }));
      return serverError(err, req);
    }
  },
});

// ─── GET /api/orders ──────────────────────────────────────────────────────────
app.http('ordersList', {
  methods:   ['GET'],
  authLevel: 'anonymous',
  route:     'orders',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };
    const correlationId = resolveCorrelationId(req);

    try {
      const authResult = await requireAuth(req, []);
      if (isAuthError(authResult)) return fromAuthError(authResult, req);

      const { caller } = authResult;
      const isAdmin    = caller.roles.some((r) => ['ADMIN', 'OPS', 'SELLER'].includes(r));

      const query    = request.query;
      const page     = Math.max(1, parseInt(query.get('page')     || '1',  10));
      const pageSize = Math.min(50, Math.max(1, parseInt(query.get('pageSize') || '20', 10)));
      const status   = query.get('status')  || null;
      const search   = query.get('q')       || null;

      let sqlWhere  = '';
      const params  = [];

      if (isAdmin) {
        // Admins ven todos
        if (status) {
          sqlWhere += ' AND o.status = @status';
          params.push({ name: 'status', type: sql.NVarChar(30), value: status });
        }
        if (search) {
          sqlWhere += ` AND (o.order_number LIKE '%' + @search + '%'
                        OR cu.email LIKE '%' + @search + '%'
                        OR JSON_VALUE(o.guest_contact_json,'$.email') LIKE '%' + @search + '%')`;
          params.push({ name: 'search', type: sql.NVarChar(200), value: search });
        }
      } else {
        // Customers solo ven los suyos
        const customerId = await _findCustomerId(caller.sub);
        if (!customerId) return ok({ data: [], pagination: { total: 0, page, pageSize, totalPages: 0 } }, req);

        sqlWhere += ' AND o.customer_id = @customerId';
        params.push({ name: 'customerId', type: sql.Int, value: customerId });
      }

      const offset = (page - 1) * pageSize;
      params.push(
        { name: 'offset',   type: sql.Int, value: offset },
        { name: 'pageSize', type: sql.Int, value: pageSize },
      );

      const result = await execQuery(
        `SELECT
           o.id, o.public_id, o.order_number, o.status, o.channel,
           o.total_usd, o.total_ars, o.fx_rate_snapshot,
           o.created_at, o.updated_at,
           COALESCE(cu.name,  JSON_VALUE(o.guest_contact_json,'$.name'))  AS customer_name,
           COALESCE(cu.email, JSON_VALUE(o.guest_contact_json,'$.email')) AS customer_email,
           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
           COUNT(*) OVER() AS total_count
         FROM orders o
         LEFT JOIN customers cu ON cu.id = o.customer_id
         WHERE 1=1 ${sqlWhere}
         ORDER BY o.created_at DESC
         OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
        params
      );

      const rows  = result.recordset;
      const total = rows[0]?.total_count ?? 0;

      return paged(rows.map(_mapOrderSummary), total, page, pageSize, req);
    } catch (err) {
      context.log(JSON.stringify({ level: 'error', message: 'ordersList error', error: err.message, correlationId }));
      return serverError(err, req);
    }
  },
});

// ─── GET /api/orders/{id} ─────────────────────────────────────────────────────
app.http('orderDetail', {
  methods:   ['GET'],
  authLevel: 'anonymous',
  route:     'orders/{id}',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };
    const correlationId = resolveCorrelationId(req);
    const id = request.params.id;

    try {
      const authResult = await requireAuth(req, []);
      if (isAuthError(authResult)) return fromAuthError(authResult, req);

      const { caller } = authResult;
      const isAdmin    = caller.roles.some((r) => ['ADMIN', 'OPS', 'SELLER'].includes(r));

      // Obtener pedido
      const orderResult = await execQuery(
        `SELECT
           o.id, o.public_id, o.order_number, o.status, o.channel,
           o.fx_rate_snapshot, o.fx_source, o.fx_timestamp,
           o.subtotal_usd, o.tax_usd, o.shipping_cost_usd, o.total_usd,
           o.subtotal_ars, o.tax_ars, o.shipping_cost_ars, o.total_ars,
           o.guest_contact_json, o.shipping_address_json,
           o.customer_notes, o.created_at, o.updated_at,
           o.customer_id,
           cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone
         FROM orders o
         LEFT JOIN customers cu ON cu.id = o.customer_id
         WHERE o.public_id = @id`,
        [{ name: 'id', type: sql.UniqueIdentifier, value: id }]
      );

      if (!orderResult.recordset.length) return notFound(`Pedido no encontrado: ${id}`, req);

      const order = orderResult.recordset[0];

      // Si es customer, verificar que sea su pedido
      if (!isAdmin) {
        const customerId = await _findCustomerId(caller.sub);
        if (order.customer_id !== customerId) return notFound(`Pedido no encontrado: ${id}`, req);
      }

      // Items
      const itemsResult = await execQuery(
        `SELECT
           oi.id, oi.sku_snapshot, oi.title_snapshot, oi.brand_snapshot,
           oi.qty, oi.unit_price_usd_snapshot, oi.iva_rate_snapshot,
           oi.line_subtotal_usd, oi.line_tax_usd, oi.line_total_usd, oi.line_total_ars,
           p.public_id AS product_public_id, p.images_json
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = @orderId
         ORDER BY oi.id ASC`,
        [{ name: 'orderId', type: sql.Int, value: order.id }]
      );

      // Último estado de shipment si existe
      const shipmentResult = await execQuery(
        `SELECT TOP 1 status, carrier, tracking_code, tracking_url, estimated_delivery, shipped_at
         FROM shipments WHERE order_id = @orderId ORDER BY created_at DESC`,
        [{ name: 'orderId', type: sql.Int, value: order.id }]
      );

      const contact    = order.customer_id
        ? { name: order.customer_name, email: order.customer_email, phone: order.customer_phone }
        : _parseJson(order.guest_contact_json, {});

      const response = {
        id:          order.public_id,
        orderNumber: order.order_number,
        status:      order.status,
        channel:     order.channel,
        contact,
        shippingAddress: _parseJson(order.shipping_address_json, null),
        notes:       order.customer_notes,
        fx: {
          rate:        parseFloat(order.fx_rate_snapshot),
          source:      order.fx_source,
          retrievedAt: order.fx_timestamp,
        },
        totals: {
          subtotalUsd:  parseFloat(order.subtotal_usd),
          taxUsd:       parseFloat(order.tax_usd),
          shippingUsd:  parseFloat(order.shipping_cost_usd),
          totalUsd:     parseFloat(order.total_usd),
          subtotalArs:  parseFloat(order.subtotal_ars),
          taxArs:       parseFloat(order.tax_ars),
          shippingArs:  parseFloat(order.shipping_cost_ars),
          totalArs:     parseFloat(order.total_ars),
        },
        items: itemsResult.recordset.map((i) => ({
          id:          i.id,
          sku:         i.sku_snapshot,
          title:       i.title_snapshot,
          brand:       i.brand_snapshot,
          image:       _parseJson(i.images_json, [])[0] || null,
          productId:   i.product_public_id,
          qty:         i.qty,
          unitPriceUsd: parseFloat(i.unit_price_usd_snapshot),
          ivaRate:     parseFloat(i.iva_rate_snapshot),
          lineSubtotalUsd: parseFloat(i.line_subtotal_usd),
          lineTaxUsd:      parseFloat(i.line_tax_usd),
          lineTotalUsd:    parseFloat(i.line_total_usd),
          lineTotalArs:    parseFloat(i.line_total_ars),
        })),
        shipment: shipmentResult.recordset[0] || null,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      };

      return ok(response, req);
    } catch (err) {
      context.log(JSON.stringify({ level: 'error', message: 'orderDetail error', error: err.message, correlationId }));
      return serverError(err, req);
    }
  },
});

// ─── PATCH /api/orders/{id}/status ───────────────────────────────────────────
app.http('ordersChangeStatus', {
  methods:   ['PATCH'],
  authLevel: 'anonymous',
  route:     'orders/{id}/status',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };
    const correlationId = resolveCorrelationId(req);
    const id = request.params.id;

    try {
      const authResult = await requireAuth(req, ['SELLER', 'OPS', 'ADMIN']);
      if (isAuthError(authResult)) return fromAuthError(authResult, req);

      const { caller } = authResult;

      let body;
      try { body = await request.json(); } catch { return badRequest('Body JSON inválido', req); }

      const { newStatus, reason } = body;
      if (!newStatus) return badRequest('newStatus es requerido', req);

      // Resolver internal ID desde public_id
      const idResult = await execQuery(
        `SELECT id FROM orders WHERE public_id = @pid`,
        [{ name: 'pid', type: sql.UniqueIdentifier, value: id }]
      );
      if (!idResult.recordset.length) return notFound(`Pedido no encontrado: ${id}`, req);
      const orderId = idResult.recordset[0].id;

      const result = await execSP('sp_ChangeOrderStatus', [
        { name: 'order_id',       type: sql.Int,           value: orderId },
        { name: 'new_status',     type: sql.NVarChar(30),  value: newStatus },
        { name: 'actor_type',     type: sql.NVarChar(20),  value: caller.roles[0]?.toLowerCase() || 'admin' },
        { name: 'actor_id',       type: sql.NVarChar(200), value: caller.sub },
        { name: 'reason',         type: sql.NVarChar(500), value: reason || null },
        { name: 'correlation_id', type: sql.NVarChar(100), value: correlationId },
      ]);

      const updated = result.recordset[0];
      context.log(JSON.stringify({
        level: 'info', message: 'order status changed',
        orderNumber: updated?.order_number, newStatus, actor: caller.sub, correlationId,
      }));

      return ok({
        id:          id,
        orderNumber: updated?.order_number,
        status:      updated?.status,
        updatedAt:   updated?.updated_at,
      }, req);
    } catch (err) {
      if (err.number === 50001) return notFound('Pedido no encontrado', req);
      if (err.number === 50002) return badRequest('No se puede cambiar desde un estado terminal', req);
      context.log(JSON.stringify({ level: 'error', message: 'ordersChangeStatus error', error: err.message, correlationId }));
      return serverError(err, req);
    }
  },
});

// ─── GET /api/orders/{id}/history ─────────────────────────────────────────────
app.http('orderHistory', {
  methods:   ['GET'],
  authLevel: 'anonymous',
  route:     'orders/{id}/history',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };
    const id  = request.params.id;

    try {
      const authResult = await requireAuth(req, []);
      if (isAuthError(authResult)) return fromAuthError(authResult, req);

      const { caller } = authResult;
      const isAdmin    = caller.roles.some((r) => ['ADMIN', 'OPS', 'SELLER'].includes(r));

      // Resolver internal ID y verificar permisos
      let whereSql = 'WHERE o.public_id = @pid';
      const params = [{ name: 'pid', type: sql.UniqueIdentifier, value: id }];

      if (!isAdmin) {
        const customerId = await _findCustomerId(caller.sub);
        whereSql += ' AND o.customer_id = @customerId';
        params.push({ name: 'customerId', type: sql.Int, value: customerId });
      }

      const orderResult = await execQuery(
        `SELECT o.id FROM orders o ${whereSql}`, params
      );
      if (!orderResult.recordset.length) return notFound(`Pedido no encontrado: ${id}`, req);
      const orderId = orderResult.recordset[0].id;

      const histResult = await execQuery(
        `SELECT from_status, to_status, actor_type, actor_id, reason, created_at
         FROM order_status_history
         WHERE order_id = @orderId
         ORDER BY created_at ASC`,
        [{ name: 'orderId', type: sql.Int, value: orderId }]
      );

      return ok(histResult.recordset, req);
    } catch (err) {
      return serverError(err, req);
    }
  },
});

// ─── Helpers internos ─────────────────────────────────────────────────────────

function _validateOrderBody(body) {
  const errors = [];
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('items es requerido y debe tener al menos 1 elemento');
  } else {
    body.items.forEach((item, i) => {
      if (!item.productId) errors.push(`items[${i}].productId es requerido`);
      if (!item.qty || item.qty < 1) errors.push(`items[${i}].qty debe ser >= 1`);
    });
  }
  if (!body.shippingAddress) errors.push('shippingAddress es requerido');
  // Si no hay token de auth, validar contacto guest
  if (!body.contact && !body.customerId) {
    // Solo se valida si no viene header de auth (se chequea afuera)
    // Acá se valida el JSON body por las dudas
  }
  return errors;
}

async function _upsertCustomer(caller) {
  const result = await execQuery(
    `MERGE customers AS target
     USING (SELECT @sub AS external_id, @email AS email, @name AS name) AS source
     ON target.external_id = source.external_id
     WHEN NOT MATCHED THEN
       INSERT (external_id, email, name) VALUES (source.external_id, source.email, source.name)
     WHEN MATCHED AND (target.email <> source.email OR target.name <> source.name) THEN
       UPDATE SET email = source.email, name = source.name, updated_at = GETUTCDATE();
     SELECT id FROM customers WHERE external_id = @sub`,
    [
      { name: 'sub',   type: sql.NVarChar(200), value: caller.sub },
      { name: 'email', type: sql.NVarChar(200), value: caller.email },
      { name: 'name',  type: sql.NVarChar(200), value: caller.name },
    ]
  );
  return result.recordset[0]?.id ?? null;
}

async function _findCustomerId(externalId) {
  const result = await execQuery(
    `SELECT id FROM customers WHERE external_id = @sub`,
    [{ name: 'sub', type: sql.NVarChar(200), value: externalId }]
  );
  return result.recordset[0]?.id ?? null;
}

function _parseJson(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function _mapOrderSummary(row) {
  return {
    id:           row.public_id,
    orderNumber:  row.order_number,
    status:       row.status,
    channel:      row.channel,
    totalUsd:     parseFloat(row.total_usd),
    totalArs:     parseFloat(row.total_ars),
    fxRate:       parseFloat(row.fx_rate_snapshot),
    customerName: row.customer_name,
    customerEmail:row.customer_email,
    itemCount:    row.item_count,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}
