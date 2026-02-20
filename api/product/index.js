// api/product/index.js
// GET /api/product?id=123  → devuelve un producto por ID con markup aplicado

const connectDB = require('../db');

module.exports = async function (context, req) {
  const headers = { 'content-type': 'application/json' };

  try {
    const id = parseInt(req.query.id || '', 10);
    if (!id) {
      context.res = { status: 400, headers, body: { error: 'Falta el parámetro id' } };
      return;
    }

    const pool = await connectDB();

    // Markup global
    const settingsRes = await pool.request().query(`
      SELECT value FROM dbo.tovaltech_settings WHERE key_name = 'global_markup_pct'
    `);
    const globalMarkup = parseFloat(settingsRes.recordset?.[0]?.value ?? '0') / 100;

    // Producto
    const result = await pool.request()
      .input('id', id)
      .query(`SELECT * FROM dbo.tovaltech_products WHERE id = @id`);

    const p = result.recordset?.[0];
    if (!p) {
      context.res = { status: 404, headers, body: { error: 'Producto no encontrado' } };
      return;
    }

    const effectiveMarkup = p.markup_pct !== null && p.markup_pct !== undefined
      ? p.markup_pct / 100
      : globalMarkup;

    const multiplier = 1 + effectiveMarkup;

    const product = {
      ...p,
      price_ars:      Math.round((p.price_ars ?? 0) * multiplier),
      price_usd:      Math.round((p.price_usd ?? 0) * multiplier * 100) / 100,
      price_ars_cost: p.price_ars,
      price_usd_cost: p.price_usd,
      markup_applied: Math.round(effectiveMarkup * 100 * 10) / 10,
    };

    context.res = { status: 200, headers, body: product };

  } catch (err) {
    context.log.error('product_error', err.message);
    context.res = {
      status: 500, headers,
      body: { error: 'product_failed', message: 'Error al obtener el producto.' },
    };
  }
};
