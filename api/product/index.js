// api/product/index.js
// GET /api/product?id=123  → devuelve un único producto con markup aplicado.

const connectDB = require('../db');
const HEADERS   = { 'content-type': 'application/json' };

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

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const id = parseInt(req.query.id ?? '', 10);
    if (!Number.isFinite(id)) {
      context.res = { status: 400, headers: HEADERS, body: { error: 'id requerido.' } };
      return;
    }

    const wantsAdmin = req.query.admin === '1';
    const isAdmin    = wantsAdmin && hasAdminRole(req);
    if (wantsAdmin && !isAdmin) {
      context.res = { status: 403, headers: HEADERS, body: { error: 'forbidden' } };
      return;
    }

    // Markup global
    const settingsRes = await pool.request().query(
      `SELECT value FROM dbo.tovaltech_settings WHERE key_name = 'global_markup_pct'`
    );
    const globalMarkupPct = parseFloat(settingsRes.recordset?.[0]?.value ?? '0');
    const globalMarkup    = globalMarkupPct / 100;

    // Markup por categoria
    const categoryMarkup = {};
    try {
      const catRes = await pool.request().query(
        `SELECT name, markup_pct FROM dbo.tovaltech_categories WHERE markup_pct IS NOT NULL`
      );
      for (const row of catRes.recordset || []) {
        const key = String(row.name ?? '').trim();
        const pct = parseFloat(row.markup_pct);
        if (key && Number.isFinite(pct)) categoryMarkup[key] = pct / 100;
      }
    } catch (e) { context.log.warn('category_markup_fetch_failed', e.message); }

    // Producto por ID
    const result = await pool.request()
      .input('id', id)
      .query(`SELECT * FROM dbo.tovaltech_products WHERE id = @id`);

    if (!result.recordset?.length) {
      context.res = { status: 404, headers: HEADERS, body: { error: 'not_found' } };
      return;
    }

    const p      = result.recordset[0];
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

    const body = {
      ...p,
      price_ars:      price_ars_sale,
      price_usd:      price_usd_sale,
      markup_applied: Math.round(effectiveMarkup * 100 * 10) / 10,
      markup_source:  markupSource,
      active:         p.active !== 0,
    };
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
