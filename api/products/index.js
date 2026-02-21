// api/products/index.js
// Endpoint público (tienda) + admin.
// Tienda: filtra stock > 0 AND active = 1
// Admin (?admin=1): ve todos sin filtros

const connectDB = require('../db');

function toInt(v, fallback) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

const CATEGORY_TABLE = 'dbo.tovaltech_categories';

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const isAdmin   = req.query.admin === '1';
    const categoria  = (req.query.categoria  || '').trim();
    const subcateg   = (req.query.subcategoria || '').trim();
    const marca      = (req.query.marca      || '').trim();
    const proveedor  = (req.query.proveedor  || '').trim();
    const buscar     = (req.query.buscar     || '').trim();
    const limit     = clamp(toInt(req.query.limit, 24), 1, 500);
    const offset    = Math.max(0, toInt(req.query.offset, 0));

    // ── Markup global ──────────────────────────────────────────────────────
    const settingsRes = await pool.request().query(`
      SELECT value FROM dbo.tovaltech_settings WHERE key_name = 'global_markup_pct'
    `);
    const globalMarkupPct = parseFloat(settingsRes.recordset?.[0]?.value ?? '0');
    const globalMarkup    = globalMarkupPct / 100;

    // ── Markup por categoría ───────────────────────────────────────────────
    const categoryMarkup = {};
    try {
      const catRes = await pool.request().query(`
        SELECT name, markup_pct FROM ${CATEGORY_TABLE} WHERE markup_pct IS NOT NULL
      `);
      for (const row of catRes.recordset || []) {
        const key = String(row.name ?? '').trim();
        const pct = parseFloat(row.markup_pct);
        if (key && Number.isFinite(pct)) categoryMarkup[key] = pct / 100;
      }
    } catch (e) { context.log.warn('category_markup_fetch_failed', e.message); }

    // ── Filtros WHERE ──────────────────────────────────────────────────────
    // Tienda: solo productos con stock > 0 Y active = 1
    // Admin:  sin filtros de visibilidad (ve todo)
    const where = isAdmin ? [] : ['stock > 0', '(active IS NULL OR active = 1)'];
    if (categoria) where.push('category = @categoria');
    if (subcateg)  where.push('subcategory = @subcategoria');
    if (marca)     where.push('brand = @marca');
    if (proveedor) where.push('provider = @proveedor');
    if (buscar)    where.push('(name LIKE @buscar OR brand LIKE @buscar OR sku LIKE @buscar OR category LIKE @buscar)');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // ── Count ──────────────────────────────────────────────────────────────
    const countReq = pool.request();
    if (categoria) countReq.input('categoria',    categoria);
    if (subcateg)  countReq.input('subcategoria', subcateg);
    if (marca)     countReq.input('marca',        marca);
    if (proveedor) countReq.input('proveedor',    proveedor);
    if (buscar)    countReq.input('buscar',       `%${buscar}%`);
    const count = await countReq.query(`SELECT COUNT(1) AS total FROM dbo.tovaltech_products ${whereSql}`);
    const total = count.recordset?.[0]?.total ?? 0;

    // ── Items ──────────────────────────────────────────────────────────────
    const itemsReq = pool.request();
    if (categoria) itemsReq.input('categoria',    categoria);
    if (subcateg)  itemsReq.input('subcategoria', subcateg);
    if (marca)     itemsReq.input('marca',        marca);
    if (proveedor) itemsReq.input('proveedor',    proveedor);
    if (buscar)    itemsReq.input('buscar',       `%${buscar}%`);
    itemsReq.input('offset', offset);
    itemsReq.input('limit',  limit);

    const items = await itemsReq.query(`
      SELECT * FROM dbo.tovaltech_products ${whereSql}
      ORDER BY featured DESC, updated_at DESC, id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    // ── Aplicar markup — producto > categoría > global ─────────────────────
    const products = (items.recordset || []).map(p => {
      const catKey = String(p.category ?? '').trim();
      let effectiveMarkup, markupSource;

      if (p.markup_pct !== null && p.markup_pct !== undefined) {
        effectiveMarkup = Number(p.markup_pct) / 100;
        markupSource    = 'product';
      } else if (catKey && categoryMarkup[catKey] !== undefined) {
        effectiveMarkup = categoryMarkup[catKey];
        markupSource    = 'category';
      } else {
        effectiveMarkup = globalMarkup;
        markupSource    = 'global';
      }

      const multiplier     = 1 + effectiveMarkup;
      const price_ars_sale = Math.round((p.price_ars ?? 0) * multiplier);
      const price_usd_sale = Math.round((p.price_usd ?? 0) * multiplier * 100) / 100;

      return {
        ...p,
        price_ars:      price_ars_sale,
        price_usd:      price_usd_sale,
        price_ars_cost: p.price_ars,
        price_usd_cost: p.price_usd,
        markup_applied: Math.round(effectiveMarkup * 100 * 10) / 10,
        markup_source:  markupSource,
        active:         p.active !== 0, // normalizar a boolean para el frontend
      };
    });

    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { items: products, total, limit, offset, global_markup_pct: globalMarkupPct },
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