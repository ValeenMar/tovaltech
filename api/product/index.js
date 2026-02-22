// api/product/index.js
// GET /api/product?id=123  → devuelve un único producto con markup aplicado.

const connectDB = require('../db');
const { requireAdminIfRequested } = require('../_shared/require-admin');
const { getMarkupSettings, applyMarkup } = require('../_shared/markup');
const HEADERS   = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const id = parseInt(req.query.id ?? '', 10);
    if (!Number.isFinite(id)) {
      context.res = { status: 400, headers: HEADERS, body: { error: 'id requerido.' } };
      return;
    }

    const adminGuard = requireAdminIfRequested(req);
    if (adminGuard.forbidden) {
      context.res = { status: 403, headers: HEADERS, body: { error: 'forbidden' } };
      return;
    }
    const isAdmin = adminGuard.isAdmin;

    const forceRefresh = req.query.bust_cache === '1' && isAdmin;
    const settings = await getMarkupSettings(pool, forceRefresh);

    // Producto por ID
    const result = await pool.request()
      .input('id', id)
      .query(`SELECT * FROM dbo.tovaltech_products WHERE id = @id`);

    if (!result.recordset?.length) {
      context.res = { status: 404, headers: HEADERS, body: { error: 'not_found' } };
      return;
    }

    const p = result.recordset[0];
    const body = applyMarkup(p, settings);
    if (isAdmin) {
      body.price_ars_cost = p.price_ars;
      body.price_usd_cost = p.price_usd;
    }

    context.res = { status: 200, headers: HEADERS, body };

  } catch (err) {
    context.log.error('product_failed', err);
    context.res = { status: 500, headers: HEADERS, body: { error: 'product_failed', message: err.message } };
  }
};
