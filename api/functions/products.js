// api/functions/products.js
'use strict';

/**
 * TovalTech 2.0 — Product endpoints
 *
 * GET  /api/products            → sp_SearchProducts (server-side pagination + filtros)
 * GET  /api/products/{id}       → producto por public_id con todas sus offers
 * GET  /api/categories          → listado de categorías activas (para filtros del catálogo)
 */

const { app }    = require('@azure/functions');
const { execSP, execQuery, sql } = require('../shared/db');
const { getCurrentFxRate }       = require('../shared/fx');
const { ok, notFound, badRequest, serverError, paged, resolveCorrelationId } = require('../shared/response');

// ─── GET /api/products ────────────────────────────────────────────────────────
app.http('productsList', {
  methods:   ['GET'],
  authLevel: 'anonymous',
  route:     'products',
  handler:   async (request, context) => {
    const correlationId = resolveCorrelationId({ headers: Object.fromEntries(request.headers) });
    context.log(JSON.stringify({ level: 'info', message: 'GET /api/products', correlationId }));

    try {
      const query = request.query;

      const page     = Math.max(1, parseInt(query.get('page')      || '1',  10));
      const pageSize = Math.min(50, Math.max(1, parseInt(query.get('pageSize') || '20', 10)));
      const q        = query.get('q')        || null;
      const category = query.get('category') || null;
      const brand    = query.get('brand')    || null;
      const minUsd   = query.get('minUsd')   ? parseFloat(query.get('minUsd'))   : null;
      const maxUsd   = query.get('maxUsd')   ? parseFloat(query.get('maxUsd'))   : null;
      const inStock  = query.get('inStock') === 'true' ? 1 : query.get('inStock') === 'false' ? 0 : null;
      const sort     = query.get('sort')     || 'created_desc';

      const VALID_SORTS = ['price_asc', 'price_desc', 'title_asc', 'created_desc'];
      if (!VALID_SORTS.includes(sort)) {
        return badRequest(`sort debe ser uno de: ${VALID_SORTS.join(', ')}`);
      }

      const result = await execSP('sp_SearchProducts', [
        { name: 'q',         type: sql.NVarChar(300),  value: q },
        { name: 'category',  type: sql.NVarChar(100),  value: category },
        { name: 'brand',     type: sql.NVarChar(100),  value: brand },
        { name: 'min_usd',   type: sql.Decimal(12, 4), value: minUsd },
        { name: 'max_usd',   type: sql.Decimal(12, 4), value: maxUsd },
        { name: 'in_stock',  type: sql.Bit,            value: inStock },
        { name: 'sort',      type: sql.NVarChar(30),   value: sort },
        { name: 'page',      type: sql.Int,            value: page },
        { name: 'page_size', type: sql.Int,            value: pageSize },
      ]);

      const rows  = result.recordset;
      const total = rows[0]?.total_count ?? 0;

      // Obtener FX actual para mostrar precios en ARS
      let fx = null;
      try { fx = await getCurrentFxRate(); } catch (_) { /* silencioso — precio ARS es opcional */ }

      const items = rows.map((r) => _mapProductRow(r, fx));

      return paged(items, total, page, pageSize, { headers: Object.fromEntries(request.headers) });
    } catch (err) {
      context.log(JSON.stringify({ level: 'error', message: 'productsList error', error: err.message, correlationId }));
      return serverError(err, { headers: Object.fromEntries(request.headers) });
    }
  },
});

// ─── GET /api/products/{id} ───────────────────────────────────────────────────
app.http('productDetail', {
  methods:   ['GET'],
  authLevel: 'anonymous',
  route:     'products/{id}',
  handler:   async (request, context) => {
    const correlationId = resolveCorrelationId({ headers: Object.fromEntries(request.headers) });
    const id = request.params.id;
    context.log(JSON.stringify({ level: 'info', message: 'GET /api/products/:id', id, correlationId }));

    try {
      // Buscar por public_id (GUID) o por SKU
      const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const productResult = await execQuery(
        `SELECT
           p.id, p.public_id, p.sku, p.title, p.brand,
           p.description, p.specs_json, p.images_json, p.tags,
           p.is_active, p.created_at, p.updated_at,
           c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1
           AND (${isGuid ? 'p.public_id = @id' : 'p.sku = @id'})`,
        [{ name: 'id', type: isGuid ? sql.UniqueIdentifier : sql.NVarChar(100), value: id }]
      );

      if (!productResult.recordset.length) {
        return notFound(`Producto no encontrado: ${id}`);
      }

      const product = productResult.recordset[0];

      // Offers activos con datos del proveedor (sin exponer datos de costos)
      const offersResult = await execQuery(
        `SELECT
           po.id AS offer_id,
           po.price_usd, po.iva_rate, po.stock_qty, po.lead_time_days,
           po.updated_at AS offer_updated_at,
           pv.name AS provider_name
         FROM product_offers po
         JOIN providers pv ON pv.id = po.provider_id
         WHERE po.product_id = @productId AND po.is_active = 1
         ORDER BY po.price_usd ASC`,
        [{ name: 'productId', type: sql.Int, value: product.id }]
      );

      let fx = null;
      try { fx = await getCurrentFxRate(); } catch (_) {}

      const bestOffer = offersResult.recordset[0] || null;

      const response = {
        id:            product.public_id,
        sku:           product.sku,
        title:         product.title,
        brand:         product.brand,
        description:   product.description,
        specs:         _parseJson(product.specs_json, {}),
        images:        _parseJson(product.images_json, []),
        tags:          product.tags ? product.tags.split(' ') : [],
        category: {
          id:   product.category_id,
          name: product.category_name,
          slug: product.category_slug,
        },
        pricing: bestOffer ? {
          offer_id:    bestOffer.offer_id,
          price_usd:   parseFloat(bestOffer.price_usd),
          iva_rate:    parseFloat(bestOffer.iva_rate),
          price_with_iva_usd: parseFloat((bestOffer.price_usd * (1 + bestOffer.iva_rate)).toFixed(4)),
          price_ars:   fx ? parseFloat((bestOffer.price_usd * (1 + bestOffer.iva_rate) * fx.rate).toFixed(2)) : null,
          fx:          fx ? { rate: fx.rate, retrievedAt: fx.retrievedAt, source: fx.source } : null,
        } : null,
        stock: {
          status:         _stockStatus(bestOffer),
          qty:            bestOffer?.stock_qty ?? null,
          lead_time_days: bestOffer?.lead_time_days ?? null,
          provider_count: offersResult.recordset.length,
        },
        offers: offersResult.recordset.map((o) => ({
          id:             o.offer_id,
          price_usd:      parseFloat(o.price_usd),
          iva_rate:       parseFloat(o.iva_rate),
          stock_qty:      o.stock_qty,
          lead_time_days: o.lead_time_days,
          provider:       o.provider_name,
          updated_at:     o.offer_updated_at,
        })),
        created_at: product.created_at,
        updated_at: product.updated_at,
      };

      return ok(response, { headers: Object.fromEntries(request.headers) });
    } catch (err) {
      context.log(JSON.stringify({ level: 'error', message: 'productDetail error', error: err.message, correlationId }));
      return serverError(err, { headers: Object.fromEntries(request.headers) });
    }
  },
});

// ─── GET /api/categories ──────────────────────────────────────────────────────
app.http('categoriesList', {
  methods:   ['GET'],
  authLevel: 'anonymous',
  route:     'categories',
  handler:   async (request, context) => {
    try {
      const result = await execQuery(
        `SELECT id, public_id, name, slug, parent_id, description, sort_order
         FROM categories
         WHERE is_active = 1
         ORDER BY sort_order ASC, name ASC`,
        []
      );
      return ok(result.recordset, { headers: Object.fromEntries(request.headers) });
    } catch (err) {
      return serverError(err, { headers: Object.fromEntries(request.headers) });
    }
  },
});

// ─── GET /api/brands ─────────────────────────────────────────────────────────
app.http('brandsList', {
  methods:   ['GET'],
  authLevel: 'anonymous',
  route:     'brands',
  handler:   async (request, context) => {
    try {
      const result = await execQuery(
        `SELECT DISTINCT brand FROM products
         WHERE is_active = 1 AND brand IS NOT NULL
         ORDER BY brand ASC`,
        []
      );
      return ok(result.recordset.map((r) => r.brand), { headers: Object.fromEntries(request.headers) });
    } catch (err) {
      return serverError(err, { headers: Object.fromEntries(request.headers) });
    }
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _parseJson(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function _stockStatus(offer) {
  if (!offer) return 'unknown';
  if (offer.stock_qty === null) return 'consultar';
  if (offer.stock_qty === 0)   return 'sin_stock';
  if (offer.stock_qty <= 3)    return 'bajo';
  return 'disponible';
}

function _mapProductRow(row, fx) {
  return {
    id:            row.public_id,
    sku:           row.sku,
    title:         row.title,
    brand:         row.brand,
    images:        _parseJson(row.images_json, []),
    category: {
      name: row.category_name,
      slug: row.category_slug,
    },
    pricing: {
      price_usd:   row.min_price_usd ? parseFloat(row.min_price_usd) : null,
      iva_rate:    row.iva_rate      ? parseFloat(row.iva_rate)       : 0.21,
      price_ars:   (fx && row.min_price_usd)
        ? parseFloat((row.min_price_usd * (1 + (row.iva_rate || 0.21)) * fx.rate).toFixed(2))
        : null,
      fx_rate:     fx?.rate ?? null,
    },
    stock: {
      qty:    row.max_stock,
      status: row.max_stock === null ? 'consultar' : row.max_stock === 0 ? 'sin_stock' : row.max_stock <= 3 ? 'bajo' : 'disponible',
    },
    created_at: row.created_at,
  };
}
