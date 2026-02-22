// api/products/index.js
// Endpoint público (tienda) + admin.
// Tienda: filtra stock > 0 AND active = 1
// Admin (?admin=1): ve todos sin filtros

const connectDB = require('../db');
const HEADERS = { 'content-type': 'application/json' };

function getClientPrincipal(req) {
  try {
    const encoded = req.headers?.['x-ms-client-principal'];
    if (!encoded) return null;
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function hasAdminRole(req) {
  const principal = getClientPrincipal(req);
  const roles = principal?.userRoles;
  return Array.isArray(roles) && roles.includes('admin');
}

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

  // Dos queries secuenciales — mssql no soporta bien paralelas en el mismo pool
  const settingsRes = await pool.request().query(
    `SELECT value FROM dbo.tovaltech_settings WHERE key_name = 'global_markup_pct'`
  );
  // Traemos TODAS las categorías (con y sin markup) para poder resolver herencia padre→hijo
  const catRes = await pool.request().query(
    `SELECT id, name, markup_pct, parent_id FROM ${CATEGORY_TABLE}`
  );

  const globalMarkupPct = parseFloat(settingsRes.recordset?.[0]?.value ?? '0');

  // Primero indexar por id para resolver herencia
  const catById = {};
  for (const row of catRes.recordset || []) {
    catById[row.id] = { name: String(row.name ?? '').trim(), markup_pct: row.markup_pct, parent_id: row.parent_id };
  }

  // Resolver markup efectivo por nombre: propio → padre → null (caerá a global en runtime)
  const categoryMarkup = {};
  for (const cat of Object.values(catById)) {
    if (!cat.name) continue;
    let pct = cat.markup_pct !== null && cat.markup_pct !== undefined ? parseFloat(cat.markup_pct) : null;
    // Si la subcategoría no tiene markup propio, sube al padre
    if ((pct === null || !Number.isFinite(pct)) && cat.parent_id) {
      const parent = catById[cat.parent_id];
      if (parent && parent.markup_pct !== null && parent.markup_pct !== undefined) {
        pct = parseFloat(parent.markup_pct);
      }
    }
    if (pct !== null && Number.isFinite(pct)) {
      categoryMarkup[cat.name] = pct / 100;
    }
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

    const wantsAdmin = req.query.admin === '1';
    const isAdmin    = wantsAdmin && hasAdminRole(req);
    if (wantsAdmin && !isAdmin) {
      context.res = { status: 403, headers: HEADERS, body: { error: 'forbidden' } };
      return;
    }

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

      const mapped = {
        ...p,
        price_ars:      price_ars_sale,
        price_usd:      price_usd_sale,
        markup_applied: Math.round(effectiveMarkup * 100 * 10) / 10,
        markup_source:  markupSource,
        active:         p.active !== 0, // normalizar a boolean para el frontend
      };

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
