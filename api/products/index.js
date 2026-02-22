// api/products/index.js
// Endpoint público (tienda) + admin.
// Tienda: filtra stock > 0 AND active = 1
// Admin (?admin=1): ve todos sin filtros

const connectDB = require('../db');
const { requireAdminIfRequested } = require('../_shared/require-admin');
const { getMarkupSettings, applyMarkup } = require('../_shared/markup');
const HEADERS = { 'content-type': 'application/json' };

function toInt(v, fallback) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const adminGuard = requireAdminIfRequested(req);
    if (adminGuard.forbidden) {
      context.res = { status: 403, headers: HEADERS, body: { error: 'forbidden' } };
      return;
    }
    const isAdmin = adminGuard.isAdmin;

    const categoria  = (req.query.categoria  || '').trim();
    const subcateg   = (req.query.subcategoria || '').trim();
    // hijos: subcategorías del padre seleccionado (separadas por coma)
    const hijosRaw   = (req.query.hijos || '').trim();
    const hijos      = hijosRaw ? hijosRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const marca      = (req.query.marca      || '').trim();
    const proveedor  = (req.query.proveedor  || '').trim();
    const buscar     = (req.query.buscar     || '').trim();
    const limit     = clamp(toInt(req.query.limit, 24), 1, 500);
    const offset    = Math.max(0, toInt(req.query.offset, 0));

    // ── Markup (cacheado en memoria, se refresca cada 2 min) ─────────────
    const forceRefresh = req.query.bust_cache === '1' && isAdmin;
    const { globalMarkup, categoryMarkup } = await getMarkupSettings(pool, forceRefresh);

    // ── Filtros WHERE ──────────────────────────────────────────────────────
    // Tienda: solo productos con stock > 0 Y active = 1
    // Admin:  sin filtros de visibilidad (ve todo)
    const where = isAdmin ? [] : ['stock > 0', '(active IS NULL OR active = 1)'];
    // Si hay hijos (padre clickeado), filtrar por la categoría padre O cualquiera de sus hijos
    if (hijos.length > 0) {
      const inList = hijos.map((_, i) => `@hijo${i}`).join(', ');
      where.push(`(category = @categoria OR category IN (${inList}))`);
    } else if (categoria) {
      where.push('category = @categoria');
    }
    if (subcateg)  where.push('subcategory = @subcategoria');
    if (marca)     where.push('brand = @marca');
    if (proveedor) where.push('provider = @proveedor');
    if (buscar)    where.push('(name LIKE @buscar OR brand LIKE @buscar OR sku LIKE @buscar OR category LIKE @buscar)');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // ── Count + Items en paralelo (Promise.all = mismo tiempo, sin riesgo) ──
    const makeReq = () => {
      const r = pool.request();
      if (categoria) r.input('categoria', categoria);
      hijos.forEach((h, i) => r.input(`hijo${i}`, h));
      if (subcateg)  r.input('subcategoria', subcateg);
      if (marca)     r.input('marca',        marca);
      if (proveedor) r.input('proveedor',    proveedor);
      if (buscar)    r.input('buscar',       `%${buscar}%`);
      return r;
    };

    const countReq = makeReq();
    const itemsReq = makeReq();
    itemsReq.input('offset', offset);
    itemsReq.input('limit',  limit);

    const countRes = await countReq.query(
      `SELECT COUNT(1) AS total FROM dbo.tovaltech_products ${whereSql}`
    );
    const items = await itemsReq.query(`
      SELECT * FROM dbo.tovaltech_products ${whereSql}
      ORDER BY featured DESC, updated_at DESC, id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const total = countRes.recordset?.[0]?.total ?? 0;

    // ── Aplicar markup — producto > categoría > global ─────────────────────
    const settings = { globalMarkup, categoryMarkup };
    const products = (items.recordset || []).map((p) => {
      const mapped = applyMarkup(p, settings);

      if (isAdmin) {
        mapped.price_ars_cost = p.price_ars;
        mapped.price_usd_cost = p.price_usd;
      }

      return mapped;
    });

    context.res = {
      status: 200,
      headers: HEADERS,
      body: { items: products, total, limit, offset, global_markup_pct: Math.round(globalMarkup * 100) },
    };

  } catch (err) {
    context.log.error('products_failed', err);
    context.res = {
      status: 500,
      headers: HEADERS,
      body: { error: 'products_failed', message: err.message },
    };
  }
};
