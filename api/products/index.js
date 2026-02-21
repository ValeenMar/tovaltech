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

// ── Cache en memoria para markup global + por categoría ──────────────────────
// Esto elimina 2 de los 4 viajes a SQL por request.
// TTL: 2 minutos — si Valentín cambia el markup en admin, tarda máx 2 min en verse.
// El admin puede forzar el refresco pasando ?bust_cache=1.
let _markupCache     = null;
let _markupCacheTime = 0;
const MARKUP_TTL = 2 * 60 * 1000;

async function getMarkupSettings(pool, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _markupCache && (now - _markupCacheTime) < MARKUP_TTL) {
    return _markupCache;
  }

  // Un solo query con UNION ALL para traer global + por categoría en 1 viaje
  const [settingsRes, catRes] = await Promise.all([
    pool.request().query(`SELECT value FROM dbo.tovaltech_settings WHERE key_name = 'global_markup_pct'`),
    pool.request().query(`SELECT name, markup_pct FROM ${CATEGORY_TABLE} WHERE markup_pct IS NOT NULL`),
  ]);

  const globalMarkupPct = parseFloat(settingsRes.recordset?.[0]?.value ?? '0');
  const categoryMarkup  = {};
  for (const row of catRes.recordset || []) {
    const key = String(row.name ?? '').trim();
    const pct = parseFloat(row.markup_pct);
    if (key && Number.isFinite(pct)) categoryMarkup[key] = pct / 100;
  }

  _markupCache     = { globalMarkup: globalMarkupPct / 100, categoryMarkup };
  _markupCacheTime = now;
  return _markupCache;
}

// Llamado desde api/settings cuando se guarda un nuevo markup
function invalidateMarkupCache() {
  _markupCache = null;
}

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const isAdmin   = req.query.admin === '1';
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

    // ── Count + Items en UN SOLO viaje a SQL ────────────────────────────────
    // COUNT(*) OVER() devuelve el total en cada fila sin una query separada.
    // Esto elimina 1 round-trip por request (de 4 viajes a 2, con el cache arriba = 1).
    const itemsReq = pool.request();
    if (categoria) itemsReq.input('categoria', categoria);
    hijos.forEach((h, i) => itemsReq.input(`hijo${i}`, h));
    if (subcateg)  itemsReq.input('subcategoria', subcateg);
    if (marca)     itemsReq.input('marca',        marca);
    if (proveedor) itemsReq.input('proveedor',    proveedor);
    if (buscar)    itemsReq.input('buscar',       `%${buscar}%`);
    itemsReq.input('offset', offset);
    itemsReq.input('limit',  limit);

    const items = await itemsReq.query(`
      SELECT *,
        COUNT(*) OVER() AS _total_count
      FROM dbo.tovaltech_products ${whereSql}
      ORDER BY featured DESC, updated_at DESC, id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const total = items.recordset?.[0]?._total_count ?? 0;

    // ── Aplicar markup — producto > categoría > global ─────────────────────
    const products = (items.recordset || []).map(({ _total_count, ...p }) => {
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