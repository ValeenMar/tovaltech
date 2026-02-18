// api/shared/importers/elit.js
'use strict';

/**
 * TovalTech 2.0 — Importer: Elit (elit.com.ar)
 *
 * Formato real detectado del feed CSV:
 *   id, codigo_alfa, codigo_producto, nombre, categoria, sub_categoria,
 *   marca, precio, impuesto_interno, iva, moneda, markup, cotizacion,
 *   pvp_usd, pvp_ars, peso, ean, nivel_stock, stock_total,
 *   stock_deposito_cliente, stock_deposito_cd, garantia,
 *   link, imagen, miniatura, atributos, gamer, creado, actualizado
 *
 * Reglas de negocio:
 *   - price_usd   = pvp_usd  (precio de venta en USD, ya calculado por Elit)
 *   - iva_rate    = iva / 100  (viene como 21, 10.5 → guardamos 0.21, 0.105)
 *   - sku         = codigo_producto  (código oficial del fabricante/distribuidor)
 *   - stock_qty   = stock_total
 *   - nivel_stock 'sin stock' → stock_qty = 0 (aunque stock_total pueda ser NULL)
 *   - Categorías se mapean a nuestras slugs o se ignoran si no hay match
 *   - Imágenes: imagen (full) → images_json = ["url"]
 *   - Se NUNCA hardcodea la URL — viene por env var
 */

const Papa = require('papaparse');
const fetch = require('node-fetch');

// Mapeo de categorías de Elit → slugs de nuestras categories
const CATEGORY_MAP = {
  'computadoras':              'servidores',
  'all in one':                'servidores',
  'hardware':                  'componentes',
  'coolers':                   'componentes',
  'memorias':                  'memorias-ram',
  'memorias ram':              'memorias-ram',
  'almacenamiento':            'almacenamiento',
  'ssds':                      'almacenamiento',
  'discos rigidos':            'almacenamiento',
  'discos sólidos':            'almacenamiento',
  'procesadores':              'procesadores',
  'cpus':                      'procesadores',
  'monitores':                 'monitores',
  'networking':                'networking',
  'redes':                     'networking',
  'periféricos':               'perifericos',
  'perifericos':               'perifericos',
  'servidores':                'servidores',
  'servidores y workstations': 'servidores',
  'placas de video':           'componentes',
  'gpus':                      'componentes',
  'motherboards':              'componentes',
  'fuentes':                   'componentes',
  'gabinetes':                 'componentes',
};

/**
 * Construye la URL del feed de Elit desde variables de entorno.
 * Nunca expone las credenciales en código.
 */
function _buildElitUrl() {
  const userId = process.env.ELIT_USER_ID;
  const token  = process.env.ELIT_TOKEN;

  if (!userId || !token) {
    throw new Error('ELIT_USER_ID y ELIT_TOKEN son requeridos en las variables de entorno');
  }

  return `https://clientes.elit.com.ar/v1/api/productos/csv?user_id=${userId}&token=${token}`;
}

/**
 * Descarga y parsea el CSV de Elit.
 * @returns {Promise<ElitProduct[]>} array de filas normalizadas
 */
async function fetchElitProducts() {
  const url = _buildElitUrl();

  console.log(JSON.stringify({
    level:   'info',
    message: 'elit: fetching CSV feed',
    urlBase: 'https://clientes.elit.com.ar/v1/api/productos/csv', // sin credenciales en log
  }));

  const res = await fetch(url, {
    headers: { 'User-Agent': 'TovalTech/2.0 import' },
    timeout: 60000,
  });

  if (!res.ok) {
    throw new Error(`Elit API HTTP ${res.status}: ${res.statusText}`);
  }

  const csvText = await res.text();

  const parsed = Papa.parse(csvText, {
    header:         true,
    skipEmptyLines: true,
    dynamicTyping:  false,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  if (parsed.errors.length > 0) {
    const criticals = parsed.errors.filter((e) => e.type === 'Quotes');
    if (criticals.length > 0) {
      console.warn(JSON.stringify({ level: 'warn', message: 'elit: CSV parse warnings', count: criticals.length }));
    }
  }

  console.log(JSON.stringify({
    level:   'info',
    message: 'elit: CSV parsed',
    rows:    parsed.data.length,
  }));

  return parsed.data.map(_normalizeRow).filter(Boolean);
}

/**
 * Normaliza una fila cruda del CSV de Elit a nuestro formato interno.
 * Retorna null si la fila debe descartarse (precio inválido, etc.).
 */
function _normalizeRow(raw) {
  // SKU: usamos codigo_producto (código del fabricante); codigo_alfa es el de Elit
  const sku = (raw.codigo_producto || raw.codigo_alfa || '').trim();
  if (!sku) return null;

  // Precio en USD
  const priceUsd = parseFloat(raw.pvp_usd);
  if (isNaN(priceUsd) || priceUsd <= 0) return null;

  // IVA: viene como 21, 10.5 → convertimos a 0.21, 0.105
  const ivaRaw  = parseFloat(raw.iva || '21');
  const ivaRate = isNaN(ivaRaw) ? 0.21 : ivaRaw / 100;

  // Stock
  const nivelStock = (raw.nivel_stock || '').toLowerCase().trim();
  let stockQty = null;
  if (nivelStock === 'sin stock') {
    stockQty = 0;
  } else {
    const stockRaw = parseInt(raw.stock_total, 10);
    stockQty = isNaN(stockRaw) ? null : stockRaw;
  }

  // Imágenes
  const images = [];
  if (raw.imagen && raw.imagen.startsWith('http')) images.push(raw.imagen.trim());
  if (raw.miniatura && raw.miniatura.startsWith('http') && raw.miniatura !== raw.imagen) {
    images.push(raw.miniatura.trim());
  }

  // Categoría → slug propio
  const catRaw  = (raw.categoria || '').toLowerCase().trim();
  const subRaw  = (raw.sub_categoria || '').toLowerCase().trim();
  const catSlug = CATEGORY_MAP[subRaw] || CATEGORY_MAP[catRaw] || null;

  // Specs básicos a partir de atributos (viene como JSON string o vacío)
  let specs = null;
  if (raw.atributos) {
    try { specs = JSON.parse(raw.atributos); } catch { specs = null; }
  }

  return {
    sku,
    title:       (raw.nombre || '').trim(),
    brand:       (raw.marca  || '').trim() || null,
    categorySlug: catSlug,
    // Datos de origen para trazabilidad
    elitId:      raw.id || null,
    elitCodeAlfa: raw.codigo_alfa || null,
    // Offer
    priceUsd,
    ivaRate,
    stockQty,
    leadTimeDays: null,   // Elit no informa días de entrega
    // Catálogo extra
    images,
    specs,
    ean:         raw.ean || null,
    productUrl:  raw.link || null,
    guarantee:   raw.garantia || null,
  };
}

/**
 * Upsert masivo de productos y offers de Elit en la DB.
 *
 * @param {object}   db       Pool de conexión (result de shared/db)
 * @param {number}   providerId  ID interno del proveedor Elit
 * @param {object[]} products   Array normalizado de fetchElitProducts()
 * @returns {{ inserted, updated, failed, errors }}
 */
async function upsertElitProducts(db, providerId, products) {
  const { execQuery, sql } = db;

  let inserted = 0, updated = 0, failed = 0;
  const errors = [];

  for (const p of products) {
    try {
      // 1. Resolver category_id desde slug
      let categoryId = null;
      if (p.categorySlug) {
        const catRes = await execQuery(
          `SELECT id FROM categories WHERE slug = @slug AND is_active = 1`,
          [{ name: 'slug', type: sql.NVarChar(100), value: p.categorySlug }]
        );
        categoryId = catRes.recordset[0]?.id ?? null;
      }

      // 2. Upsert product
      const imagesJson = p.images.length > 0 ? JSON.stringify(p.images) : null;
      const specsJson  = p.specs ? JSON.stringify(p.specs) : null;

      const productRes = await execQuery(
        `MERGE products AS t
         USING (SELECT @sku AS sku) AS s ON t.sku = s.sku
         WHEN MATCHED THEN UPDATE SET
           title       = @title,
           brand       = @brand,
           category_id = COALESCE(@categoryId, t.category_id),
           images_json = COALESCE(@imagesJson, t.images_json),
           specs_json  = COALESCE(@specsJson, t.specs_json),
           updated_at  = GETUTCDATE()
         WHEN NOT MATCHED THEN INSERT
           (sku, title, brand, category_id, images_json, specs_json, is_active)
         VALUES
           (@sku, @title, @brand, @categoryId, @imagesJson, @specsJson, 1);
         SELECT id, $action AS merge_action FROM products WHERE sku = @sku`,
        [
          { name: 'sku',        type: sql.NVarChar(100),  value: p.sku },
          { name: 'title',      type: sql.NVarChar(500),  value: p.title },
          { name: 'brand',      type: sql.NVarChar(100),  value: p.brand },
          { name: 'categoryId', type: sql.Int,            value: categoryId },
          { name: 'imagesJson', type: sql.NVarChar('max'),value: imagesJson },
          { name: 'specsJson',  type: sql.NVarChar('max'),value: specsJson },
        ]
      );

      const productId    = productRes.recordset[0].id;
      const mergeAction  = productRes.recordset[0].merge_action;
      if (mergeAction === 'INSERT') inserted++; else updated++;

      // 3. Upsert offer (precio + stock del proveedor Elit)
      await execQuery(
        `MERGE product_offers AS t
         USING (SELECT @productId AS product_id, @providerId AS provider_id) AS s
           ON t.product_id = s.product_id AND t.provider_id = s.provider_id
         WHEN MATCHED THEN UPDATE SET
           price_usd   = @priceUsd,
           iva_rate    = @ivaRate,
           stock_qty   = @stockQty,
           source      = 'elit_csv',
           imported_at = GETUTCDATE(),
           is_active   = 1
         WHEN NOT MATCHED THEN INSERT
           (product_id, provider_id, price_usd, iva_rate, stock_qty, source, imported_at)
         VALUES
           (@productId, @providerId, @priceUsd, @ivaRate, @stockQty, 'elit_csv', GETUTCDATE())`,
        [
          { name: 'productId',  type: sql.Int,            value: productId },
          { name: 'providerId', type: sql.Int,            value: providerId },
          { name: 'priceUsd',   type: sql.Decimal(12, 4), value: p.priceUsd },
          { name: 'ivaRate',    type: sql.Decimal(5, 4),  value: p.ivaRate },
          { name: 'stockQty',   type: sql.Int,            value: p.stockQty },
        ]
      );
    } catch (err) {
      failed++;
      errors.push({ sku: p.sku, error: err.message });
    }
  }

  return { inserted, updated, failed, errors };
}

module.exports = { fetchElitProducts, upsertElitProducts };
