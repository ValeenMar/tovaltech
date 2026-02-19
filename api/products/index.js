const connectDB = require('../db');

function toInt(v, fallback) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const categoria = (req.query.categoria || '').trim();
    const marca     = (req.query.marca     || '').trim();
    const proveedor = (req.query.proveedor || '').trim();
    const buscar    = (req.query.buscar    || '').trim();
    const limit     = clamp(toInt(req.query.limit,  24), 1, 200);
    const offset    = Math.max(0, toInt(req.query.offset, 0));

    // Leer markup global
    const settingsRes = await pool.request().query(`
      SELECT value FROM dbo.tovaltech_settings WHERE key_name = 'global_markup_pct'
    `);
    const globalMarkup = parseFloat(settingsRes.recordset?.[0]?.value ?? '0') / 100;

    // Filtros WHERE
    const where = ['stock > 0'];
    if (categoria) where.push('category = @categoria');
    if (marca)     where.push('brand = @marca');
    if (proveedor) where.push('provider = @proveedor');
    if (buscar)    where.push('(name LIKE @buscar OR brand LIKE @buscar OR sku LIKE @buscar)');
    const whereSql = `WHERE ${where.join(' AND ')}`;

    // Contar total
    const countReq = pool.request();
    if (categoria) countReq.input('categoria', categoria);
    if (marca)     countReq.input('marca',     marca);
    if (proveedor) countReq.input('proveedor', proveedor);
    if (buscar)    countReq.input('buscar',    `%${buscar}%`);
    const count  = await countReq.query(`SELECT COUNT(1) AS total FROM dbo.tovaltech_products ${whereSql}`);
    const total  = count.recordset?.[0]?.total ?? 0;

    // Traer items
    const itemsReq = pool.request();
    if (categoria) itemsReq.input('categoria', categoria);
    if (marca)     itemsReq.input('marca',     marca);
    if (proveedor) itemsReq.input('proveedor', proveedor);
    if (buscar)    itemsReq.input('buscar',    `%${buscar}%`);
    itemsReq.input('offset', offset);
    itemsReq.input('limit',  limit);

    const items = await itemsReq.query(`
      SELECT *
      FROM dbo.tovaltech_products
      ${whereSql}
      ORDER BY featured DESC, updated_at DESC, id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    // Aplicar markup a cada producto
    const products = (items.recordset || []).map(p => {
      // Markup efectivo: usa el del producto si está seteado, sino el global
      const effectiveMarkup = p.markup_pct !== null && p.markup_pct !== undefined
        ? p.markup_pct / 100
        : globalMarkup;

      const multiplier    = 1 + effectiveMarkup;
      const price_ars_sale = Math.round((p.price_ars ?? 0) * multiplier);
      const price_usd_sale = Math.round((p.price_usd ?? 0) * multiplier * 100) / 100;

      return {
        ...p,
        // Precios de venta (con markup)
        price_ars:  price_ars_sale,
        price_usd:  price_usd_sale,
        // Precios de costo (para referencia en admin)
        price_ars_cost: p.price_ars,
        price_usd_cost: p.price_usd,
        // Markup efectivo aplicado
        markup_applied: Math.round(effectiveMarkup * 100 * 10) / 10,
      };
    });

    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { items: products, total, limit, offset, global_markup_pct: globalMarkup * 100 },
    };

  } catch (err) {
    context.log.error('products_failed', err);
    context.res = {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: { error: 'products_failed', message: err.message },
    };
  }
};
