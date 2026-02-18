// api/shared/importers/nb.js
'use strict';

/**
 * TovalTech 2.0 — Importer: NB (nb.com.ar)
 *
 * Formato: XLSX binario
 * El mapeo de columnas viene 100% por variables de entorno porque el archivo
 * real es binario y no podemos verlo en tiempo de desarrollo.
 *
 * Variables de entorno requeridas:
 *   NB_TOKEN        → token de autenticación en la URL
 *   NB_PROVIDER_ID  → ID interno del proveedor en nuestra DB
 *   NB_COL_SKU      → nombre exacto de la columna con el código de producto
 *   NB_COL_TITLE    → columna con la descripción/nombre del producto
 *   NB_COL_BRAND    → columna con la marca (opcional)
 *   NB_COL_PRICE    → columna con el precio (asumimos USD; ver NB_PRICE_CURRENCY)
 *   NB_COL_STOCK    → columna con el stock (opcional)
 *   NB_COL_IVA      → columna con el IVA en % (opcional, default 21)
 *   NB_COL_LEAD     → columna con días de entrega (opcional)
 *   NB_PRICE_CURRENCY → 'USD' | 'ARS' (default: 'USD')
 *   NB_SHEET_NAME   → nombre de la hoja a leer (default: primera hoja)
 *   NB_SKIP_ROWS    → filas a saltear al inicio (default: 0)
 */

const XLSX  = require('xlsx');
const fetch = require('node-fetch');

/**
 * Construye la URL del feed de NB desde env vars (sin credenciales en código).
 */
function _buildNbUrl() {
  const token = process.env.NB_TOKEN;
  if (!token) throw new Error('NB_TOKEN es requerido en las variables de entorno');
  return `https://api.nb.com.ar/v1/priceListCsv/${token}`;
}

/**
 * Lee la config de columnas desde env vars.
 * Esto permite ajustar el mapeo sin tocar código.
 */
function _getColConfig() {
  return {
    sku:      process.env.NB_COL_SKU    || 'Codigo',
    title:    process.env.NB_COL_TITLE  || 'Descripcion',
    brand:    process.env.NB_COL_BRAND  || 'Marca',
    price:    process.env.NB_COL_PRICE  || 'Precio USD',
    stock:    process.env.NB_COL_STOCK  || 'Stock',
    iva:      process.env.NB_COL_IVA    || null,
    lead:     process.env.NB_COL_LEAD   || null,
    category: process.env.NB_COL_CAT   || null,
    image:    process.env.NB_COL_IMAGE || null,
    currency: (process.env.NB_PRICE_CURRENCY || 'USD').toUpperCase(),
    sheet:    process.env.NB_SHEET_NAME || null,    // null = primera hoja
    skipRows: parseInt(process.env.NB_SKIP_ROWS || '0', 10),
  };
}

/**
 * Descarga el XLSX de NB y parsea su contenido.
 * @returns {Promise<NbProduct[]>} productos normalizados
 */
async function fetchNbProducts() {
  const url = _buildNbUrl();

  console.log(JSON.stringify({
    level:   'info',
    message: 'nb: fetching XLSX feed',
    urlBase: 'https://api.nb.com.ar/v1/priceListCsv/', // sin token en log
  }));

  const res = await fetch(url, {
    headers: { 'User-Agent': 'TovalTech/2.0 import' },
    timeout: 60000,
  });

  if (!res.ok) throw new Error(`NB API HTTP ${res.status}: ${res.statusText}`);

  const buffer = await res.buffer();
  return _parseXlsx(buffer);
}

/**
 * Parsea un buffer XLSX (puede usarse también con archivo subido manualmente).
 * @param {Buffer} buffer
 * @returns {NbProduct[]}
 */
function _parseXlsx(buffer) {
  const cfg  = _getColConfig();

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  // Elegir hoja
  const sheetName = cfg.sheet
    ? workbook.SheetNames.find((n) => n.toLowerCase() === cfg.sheet.toLowerCase()) || workbook.SheetNames[0]
    : workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada en el XLSX de NB`);

  const rows = XLSX.utils.sheet_to_json(sheet, {
    raw:       false,
    defval:    '',
    range:     cfg.skipRows || undefined,
  });

  console.log(JSON.stringify({
    level:   'info',
    message: 'nb: XLSX parsed',
    sheet:   sheetName,
    rows:    rows.length,
    cols:    Object.keys(rows[0] || {}).join(', '),
  }));

  return rows.map((row) => _normalizeRow(row, cfg)).filter(Boolean);
}

/**
 * Normaliza una fila del XLSX de NB.
 */
function _normalizeRow(raw, cfg) {
  const sku = _str(raw[cfg.sku]);
  if (!sku) return null;

  // Precio — soporta formato "$ 1.234,56" o "1234.56"
  const priceRaw = _num(_str(raw[cfg.price]).replace(/[$\s]/g, '').replace('.', '').replace(',', '.'));
  if (isNaN(priceRaw) || priceRaw <= 0) return null;

  // Si el precio viene en ARS, convertimos a USD en el momento del import
  // usando el fx actual. PERO para no depender del FX acá, guardamos la
  // moneda y dejamos que el caller lo convierta si es necesario.
  // En práctica NB debería tener precio en USD según config.
  const priceUsd   = cfg.currency === 'USD' ? priceRaw : null;  // ARS path: conversión en upsert
  const priceArs   = cfg.currency === 'ARS' ? priceRaw : null;

  // IVA
  let ivaRate = 0.21;
  if (cfg.iva && raw[cfg.iva]) {
    const ivaRaw = _num(raw[cfg.iva]);
    if (!isNaN(ivaRaw)) ivaRate = ivaRaw > 1 ? ivaRaw / 100 : ivaRaw;
  }

  // Stock
  let stockQty = null;
  if (cfg.stock && raw[cfg.stock] !== undefined && raw[cfg.stock] !== '') {
    const s = _num(raw[cfg.stock]);
    if (!isNaN(s)) stockQty = Math.max(0, Math.floor(s));
  }

  // Lead time
  let leadTimeDays = null;
  if (cfg.lead && raw[cfg.lead]) {
    const l = _num(raw[cfg.lead]);
    if (!isNaN(l)) leadTimeDays = Math.max(0, Math.floor(l));
  }

  // Categoría (si el XLSX la trae)
  const categoryRaw = cfg.category ? _str(raw[cfg.category]) : null;

  // Imagen
  const imageUrl = cfg.image ? _str(raw[cfg.image]) : null;

  return {
    sku,
    title:       _str(raw[cfg.title]) || sku,
    brand:       _str(raw[cfg.brand]) || null,
    categoryRaw,
    priceUsd,
    priceArs,     // sólo si currency === 'ARS'
    ivaRate,
    stockQty,
    leadTimeDays,
    images:       imageUrl && imageUrl.startsWith('http') ? [imageUrl] : [],
  };
}

/**
 * Upsert masivo de productos y offers de NB en la DB.
 * Si priceUsd es null (ARS), se requiere el fxRate para convertir.
 *
 * @param {object}   db
 * @param {number}   providerId
 * @param {object[]} products
 * @param {number}   [fxRate]   — requerido si NB_PRICE_CURRENCY=ARS
 */
async function upsertNbProducts(db, providerId, products, fxRate = null) {
  const { execQuery, sql } = db;

  let inserted = 0, updated = 0, failed = 0;
  const errors = [];

  for (const p of products) {
    try {
      // Resolver precio en USD
      let priceUsd = p.priceUsd;
      if (priceUsd === null) {
        if (!fxRate || fxRate <= 0) throw new Error(`fxRate requerido para convertir ARS→USD (sku: ${p.sku})`);
        priceUsd = parseFloat((p.priceArs / fxRate).toFixed(4));
      }

      // Upsert product (sin tocar category si ya tiene una)
      const imagesJson = p.images.length > 0 ? JSON.stringify(p.images) : null;

      const productRes = await execQuery(
        `MERGE products AS t
         USING (SELECT @sku AS sku) AS s ON t.sku = s.sku
         WHEN MATCHED THEN UPDATE SET
           title       = @title,
           brand       = COALESCE(@brand, t.brand),
           images_json = COALESCE(@imagesJson, t.images_json),
           updated_at  = GETUTCDATE()
         WHEN NOT MATCHED THEN INSERT
           (sku, title, brand, images_json, is_active)
         VALUES
           (@sku, @title, @brand, @imagesJson, 1);
         SELECT id FROM products WHERE sku = @sku`,
        [
          { name: 'sku',        type: sql.NVarChar(100),  value: p.sku },
          { name: 'title',      type: sql.NVarChar(500),  value: p.title },
          { name: 'brand',      type: sql.NVarChar(100),  value: p.brand },
          { name: 'imagesJson', type: sql.NVarChar('max'),value: imagesJson },
        ]
      );

      const productId = productRes.recordset[0].id;
      inserted++;  // simplificado; la distinción INSERT/UPDATE requiere $action

      // Upsert offer
      await execQuery(
        `MERGE product_offers AS t
         USING (SELECT @productId AS product_id, @providerId AS provider_id) AS s
           ON t.product_id = s.product_id AND t.provider_id = s.provider_id
         WHEN MATCHED THEN UPDATE SET
           price_usd    = @priceUsd,
           iva_rate     = @ivaRate,
           stock_qty    = @stockQty,
           lead_time_days = @leadTime,
           source       = 'nb_xlsx',
           imported_at  = GETUTCDATE(),
           is_active    = 1
         WHEN NOT MATCHED THEN INSERT
           (product_id, provider_id, price_usd, iva_rate, stock_qty, lead_time_days, source, imported_at)
         VALUES
           (@productId, @providerId, @priceUsd, @ivaRate, @stockQty, @leadTime, 'nb_xlsx', GETUTCDATE())`,
        [
          { name: 'productId',  type: sql.Int,            value: productId },
          { name: 'providerId', type: sql.Int,            value: providerId },
          { name: 'priceUsd',   type: sql.Decimal(12, 4), value: priceUsd },
          { name: 'ivaRate',    type: sql.Decimal(5, 4),  value: p.ivaRate },
          { name: 'stockQty',   type: sql.Int,            value: p.stockQty },
          { name: 'leadTime',   type: sql.Int,            value: p.leadTimeDays },
        ]
      );
    } catch (err) {
      failed++;
      errors.push({ sku: p.sku, error: err.message });
    }
  }

  return { inserted, updated, failed, errors };
}

module.exports = { fetchNbProducts, upsertNbProducts, _parseXlsx };
