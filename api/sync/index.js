const fetch    = require('node-fetch');
const sql      = require('mssql');
const XLSX     = require('xlsx');
const connectDB = require('../db');

const ELIT_URL     = process.env.ELIT_API_URL;
const NEWBYTES_URL = process.env.NEWBYTES_API_URL;
const INVID_USER   = process.env.INVID_USER;
const INVID_PASS   = process.env.INVID_PASS;
const DOLAR_URL    = 'https://dolarapi.com/v1/dolares/oficial';

// URLs de Invid
const INVID_LOGIN_URL  = 'https://www.invidcomputers.com/login.php';
const INVID_EXCEL_URL  = 'https://www.invidcomputers.com/genera_excel.php';

// ── Helpers numéricos ──────────────────────────────────────────────────────────

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === '-') return null;

  let normalized;
  if (s.includes(',')) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = s.replace(/[^0-9.]/g, '');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseIntSafe(value, fallback = 0) {
  const n = parseInt(String(value || '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  const s = String(value ?? '').trim();
  return s.length ? s : null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Parser CSV propio (soporta campos entrecomillados) ────────────────────────

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') { field += '"'; i += 1; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"')      { inQuotes = true; continue; }
    if (c === delimiter) { row.push(field); field = ''; continue; }

    if (c === '\n') {
      row.push(field); field = '';
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    if (c === '\r') continue;
    field += c;
  }

  row.push(field);
  if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h || '').trim());
  const out = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    const obj = {};
    for (let j = 0; j < header.length; j += 1) {
      obj[header[j]] = r[j] ?? '';
    }
    out.push(obj);
  }
  return out;
}

// ── Fetchers genéricos ────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
  return res.text();
}

// ── Invid: login + descarga del Excel ────────────────────────────────────────
//
// El sitio usa sesión PHP (cookie PHPSESSID). El flujo es:
//   1. POST /login.php con usuario y contraseña → el servidor devuelve Set-Cookie
//   2. GET /genera_excel.php con esa cookie → devuelve el .xlsx como buffer
//
// Variables de entorno requeridas: INVID_USER, INVID_PASS

async function fetchInvidExcel() {
  if (!INVID_USER || !INVID_PASS) {
    throw new Error('Faltan variables INVID_USER o INVID_PASS');
  }

  // ── Paso 1: Login ──────────────────────────────────────────────────────────
  const loginBody = new URLSearchParams({
    usuario:    INVID_USER,   // campo del formulario de login
    password:   INVID_PASS,   // campo del formulario de login
    // Algunos sitios PHP usan 'user'/'pass' o 'email'/'password'.
    // Si el login falla, revisar los nombres exactos en DevTools → Network → login.php
  });

  const loginRes = await fetch(INVID_LOGIN_URL, {
    method:   'POST',
    headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:     loginBody.toString(),
    redirect: 'manual', // no seguir el redirect automáticamente
  });

  // Extraer todas las cookies del Set-Cookie header
  const rawCookies = loginRes.headers.raw?.()?.['set-cookie']
    ?? (loginRes.headers.get('set-cookie') ? [loginRes.headers.get('set-cookie')] : []);

  if (!rawCookies.length) {
    throw new Error('Invid login: no se recibieron cookies. Verificar INVID_USER y INVID_PASS');
  }

  // Construir string de cookies para el siguiente request
  const cookieStr = rawCookies
    .map(c => c.split(';')[0].trim())
    .join('; ');

  // ── Paso 2: Descargar el Excel con la sesión activa ────────────────────────
  const excelRes = await fetch(INVID_EXCEL_URL, {
    headers: { 'Cookie': cookieStr },
  });

  if (!excelRes.ok) {
    throw new Error(`Invid excel: HTTP ${excelRes.status}. ¿La sesión es válida?`);
  }

  const contentType = excelRes.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    // El servidor devolvió HTML → probablemente redirigió al login (sesión inválida)
    throw new Error('Invid excel: la sesión no es válida (redirigió a login). Verificar credenciales');
  }

  const buffer = await excelRes.buffer();
  return buffer;
}

// ── Parser del Excel de Invid ─────────────────────────────────────────────────
//
// Estructura del Excel:
//   Filas 1-8: encabezado con datos del mayorista, TC, etc.
//   Fila 9:    headers de columnas
//   Desde fila 10:
//     - Fila de categoría: columna A vacía, columna B = nombre de categoría
//     - Fila de producto:  columna A = código numérico
//
// Columnas (base 0):
//   0: Codigo  1: Producto  2: Fabricante  3: Nro.Parte
//   4: Moneda  5: Precio sin IVA  6: %IVA  7: Imp.Int.
//   8: Precio Final (USD con IVA)  9: Precio en ARS (ignorado)  10: Observaciones

function parseInvidExcel(buffer, dolar) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const products = [];
  let currentCategory = null;
  let dataStarted = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(v => v !== null)) continue;

    const col0 = row[0] != null ? String(row[0]).trim() : '';
    const col1 = row[1] != null ? String(row[1]).trim() : '';

    // Detectar la fila de headers (fila 9 del Excel)
    if (col0 === 'Codigo' || col0 === 'Código') {
      dataStarted = true;
      continue;
    }

    if (!dataStarted) continue;

    // Fila de categoría: columna A vacía, columna B tiene el nombre
    if (!col0 && col1 && row[8] == null) {
      // Limpiar el nombre de categoría: "Conectividad /Router" → "Conectividad/Router"
      currentCategory = col1.replace(/\s*\/\s*/g, '/').trim();
      continue;
    }

    // Fila de producto: columna A tiene un código numérico
    if (!col0 || !/^\d+$/.test(col0)) continue;

    const priceUsd = parseNumber(row[8]); // Precio Final con IVA en USD
    const name     = normalizeText(row[1]);
    if (!priceUsd || !name) continue;

    // Limpiar el nombre: a veces trae "(7833)" al final → quitar esos sufijos numéricos
    const cleanName = name.replace(/\s*\(\d{4,}\)\s*$/, '').trim();

    // SKU: prefijo INVID- para evitar colisiones con Elit/NewBytes
    const sku = `INVID-${col0}`;

    products.push({
      sku,
      name:       cleanName,
      category:   currentCategory,
      brand:      normalizeText(row[2]),
      price_usd:  round2(priceUsd),
      price_ars:  Math.max(0, Math.round(priceUsd * dolar)),
      stock:      0,             // Invid no da stock numérico
      image_url:  null,          // sin imagen → placeholder en la tienda
      provider:   'invid',
      warranty:   null,
      dolar_rate: round2(dolar),
    });
  }

  return products;
}

// ── Mappers mayoristas CSV ────────────────────────────────────────────────────

function mapElit(row, dolar) {
  const sku      = normalizeText(row.codigo_alfa);
  const name     = normalizeText(row.nombre);
  const category = normalizeText(row.categoria);
  const brand    = normalizeText(row.marca);
  const priceUsd = parseNumber(row.pvp_usd);
  const stock    = parseIntSafe(row.stock_total, 0);
  const imageUrl = normalizeText(row.imagen);
  const warranty = normalizeText(row.garantia);

  if (!sku || !name || !priceUsd) return null;

  return {
    sku, name, category, brand,
    price_usd:  round2(priceUsd),
    price_ars:  Math.max(0, Math.round(priceUsd * dolar)),
    stock, image_url: imageUrl,
    provider:   'elit',
    warranty,
    dolar_rate: round2(dolar),
  };
}

function mapNewBytes(row, dolar) {
  const sku      = normalizeText(row.CODIGO);
  const name     = normalizeText(row.DETALLE_USUARIO || row.DETALLE);
  const category = normalizeText(row.CATEGORIA_USUARIO || row.CATEGORIA);
  const brand    = normalizeText(row.MARCA);
  const priceUsd = parseNumber(row['PRECIO USD CON UTILIDAD'] || row['PRECIO FINAL']);
  const priceArs = parseNumber(row['PRECIO PESOS CON UTILIDAD'] || row['PRECIO PESOS CON IVA']);
  const stock    = parseIntSafe(row.STOCK, 0);
  const imageUrl = normalizeText(row.IMAGEN);
  const warranty = normalizeText(row.GARANTIA);

  if (!sku || !name || !priceUsd) return null;

  return {
    sku, name, category, brand,
    price_usd:  round2(priceUsd),
    price_ars:  Math.max(0, Math.round(priceArs ?? priceUsd * dolar)),
    stock, image_url: imageUrl,
    provider:   'newbytes',
    warranty,
    dolar_rate: round2(dolar),
  };
}

// ── Merge con staging table ───────────────────────────────────────────────────

async function mergeProducts(pool, products) {
  if (!products.length) return { inserted: 0, updated: 0, total: 0 };

  await pool.request().query(`TRUNCATE TABLE dbo.tovaltech_staging`);

  const table = new sql.Table('dbo.tovaltech_staging');
  table.create = false;
  table.columns.add('sku',        sql.NVarChar(100),   { nullable: false });
  table.columns.add('name',       sql.NVarChar(300),   { nullable: false });
  table.columns.add('category',   sql.NVarChar(100),   { nullable: true });
  table.columns.add('brand',      sql.NVarChar(100),   { nullable: true });
  table.columns.add('price_usd',  sql.Decimal(10, 2),  { nullable: false });
  table.columns.add('price_ars',  sql.Int,             { nullable: false });
  table.columns.add('stock',      sql.Int,             { nullable: false });
  table.columns.add('image_url',  sql.NVarChar(500),   { nullable: true });
  table.columns.add('provider',   sql.NVarChar(20),    { nullable: true });
  table.columns.add('warranty',   sql.NVarChar(50),    { nullable: true });
  table.columns.add('dolar_rate', sql.Decimal(10, 2),  { nullable: true });

  for (const p of products) {
    table.rows.add(
      p.sku, p.name, p.category, p.brand,
      p.price_usd, p.price_ars, p.stock,
      p.image_url, p.provider, p.warranty, p.dolar_rate
    );
  }

  await pool.request().bulk(table);

  const result = await pool.request().query(`
    DECLARE @merge_output TABLE(action NVARCHAR(10));

    MERGE tovaltech_products AS t
    USING dbo.tovaltech_staging AS s ON t.sku = s.sku
    WHEN MATCHED THEN
      UPDATE SET
        t.name       = s.name,
        t.category   = s.category,
        t.brand      = s.brand,
        t.price_usd  = s.price_usd,
        t.price_ars  = s.price_ars,
        t.stock      = s.stock,
        t.image_url  = ISNULL(t.image_url, s.image_url),  -- no sobreescribir imagen si ya tiene una
        t.provider   = s.provider,
        t.warranty   = s.warranty,
        t.dolar_rate = s.dolar_rate,
        t.updated_at = GETDATE()
    WHEN NOT MATCHED THEN
      INSERT (sku, name, category, brand, price_usd, price_ars, stock,
              image_url, provider, warranty, dolar_rate, active, featured, created_at, updated_at)
      VALUES (s.sku, s.name, s.category, s.brand, s.price_usd, s.price_ars, s.stock,
              s.image_url, s.provider, s.warranty, s.dolar_rate,
              -- Invid sin imagen → oculto por defecto hasta que tengan foto
              CASE WHEN s.image_url IS NULL THEN 0 ELSE 1 END,
              0, GETDATE(), GETDATE())
    OUTPUT $action INTO @merge_output;

    SELECT
      SUM(CASE WHEN action = 'INSERT' THEN 1 ELSE 0 END) AS inserted,
      SUM(CASE WHEN action = 'UPDATE' THEN 1 ELSE 0 END) AS updated,
      COUNT(1) AS total
    FROM @merge_output;
  `);

  const row = result.recordset?.[0] || { inserted: 0, updated: 0, total: 0 };
  return {
    inserted: parseInt(row.inserted || 0, 10),
    updated:  parseInt(row.updated  || 0, 10),
    total:    parseInt(row.total    || 0, 10),
  };
}

// ── Sync de categorías nuevas ─────────────────────────────────────────────────

async function syncNewCategories(pool, products) {
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
  if (!cats.length) return;

  const values = cats.map((_, i) => `(@cat${i})`).join(', ');
  const req = pool.request();
  cats.forEach((cat, i) => req.input(`cat${i}`, cat));

  await req.query(`
    MERGE dbo.tovaltech_categories AS t
    USING (VALUES ${values}) AS s(name) ON t.name = s.name
    WHEN NOT MATCHED THEN
      INSERT (name) VALUES (s.name);
  `);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Handler principal ─────────────────────────────────────────────────────────

module.exports = async function (context, req) {
  const headers = { 'content-type': 'application/json' };

  if (!ELIT_URL || !NEWBYTES_URL) {
    context.res = {
      status: 500, headers,
      body: { success: false, error: 'Faltan variables ELIT_API_URL o NEWBYTES_API_URL' },
    };
    return;
  }

  const startTime = Date.now();
  const hasInvid  = Boolean(INVID_USER && INVID_PASS);

  try {
    context.log.info('sync_start', { invid: hasInvid });

    // ── 1. Descargar todas las fuentes en paralelo (Invid solo si tiene credenciales) ──
    const promises = [
      fetchText(ELIT_URL),
      fetchText(NEWBYTES_URL),
      fetchJson(DOLAR_URL),
    ];
    if (hasInvid) promises.push(fetchInvidExcel());

    const results   = await Promise.allSettled(promises);
    const elitCsv   = results[0].status === 'fulfilled' ? results[0].value : null;
    const nbCsv     = results[1].status === 'fulfilled' ? results[1].value : null;
    const dolarData = results[2].status === 'fulfilled' ? results[2].value : null;
    const invidBuf  = hasInvid && results[3]?.status === 'fulfilled' ? results[3].value : null;

    const elitError   = results[0].status === 'rejected' ? results[0].reason?.message : null;
    const nbError     = results[1].status === 'rejected' ? results[1].reason?.message : null;
    const invidError  = hasInvid && results[3]?.status === 'rejected' ? results[3].reason?.message : null;

    if (!elitCsv && !nbCsv && !invidBuf) {
      throw new Error(`Ninguna fuente pudo descargarse. Elit: ${elitError} | NB: ${nbError}`);
    }

    const dolar = parseNumber(dolarData?.venta) ?? parseNumber(dolarData?.promedio) ?? 1400;
    context.log.info('sync_dolar', { dolar });

    // ── 2. Parsear ─────────────────────────────────────────────────────────
    const elitProducts  = elitCsv  ? rowsToObjects(parseCsv(elitCsv, ',')).map(r => mapElit(r, dolar)).filter(Boolean)     : [];
    const nbProducts    = nbCsv    ? rowsToObjects(parseCsv(nbCsv, ';')).map(r => mapNewBytes(r, dolar)).filter(Boolean)   : [];
    const invidProducts = invidBuf ? parseInvidExcel(invidBuf, dolar)                                                        : [];

    context.log.info('sync_parsed', {
      elit_ok: elitProducts.length,
      nb_ok:   nbProducts.length,
      invid_ok: invidProducts.length,
    });

    // ── 3. Merge en Azure SQL ──────────────────────────────────────────────
    const pool = await connectDB();

    const mergeSource = async (products) => {
      let merged = { inserted: 0, updated: 0, total: 0 };
      for (const ch of chunk(products, 2000)) {
        const r = await mergeProducts(pool, ch);
        merged = {
          inserted: merged.inserted + r.inserted,
          updated:  merged.updated  + r.updated,
          total:    merged.total    + r.total,
        };
      }
      return merged;
    };

    const elitMerged  = await mergeSource(elitProducts);
    const nbMerged    = await mergeSource(nbProducts);
    const invidMerged = await mergeSource(invidProducts);

    // ── 4. Sincronizar categorías nuevas ───────────────────────────────────
    await syncNewCategories(pool, [...elitProducts, ...nbProducts, ...invidProducts]);

    // ── 5. Guardar resultado en settings ───────────────────────────────────
    const duration = Math.round((Date.now() - startTime) / 1000);
    const syncResult = {
      success:       true,
      dolar_oficial: dolar,
      elit:          { ...elitMerged,  parsed: elitProducts.length,  error: elitError  },
      newbytes:      { ...nbMerged,    parsed: nbProducts.length,    error: nbError    },
      invid:         { ...invidMerged, parsed: invidProducts.length, error: invidError,
                       skipped: !hasInvid ? 'sin_credenciales' : null },
      total:         elitMerged.total + nbMerged.total + invidMerged.total,
      duration_sec:  duration,
      timestamp:     new Date().toISOString(),
    };

    await pool.request()
      .input('value', JSON.stringify(syncResult))
      .query(`
        UPDATE dbo.tovaltech_settings
        SET value = @value, updated_at = GETDATE()
        WHERE key_name = 'last_sync_result'
      `);

    context.log.info('sync_complete', syncResult);
    context.res = { status: 200, headers, body: syncResult };

  } catch (err) {
    context.log.error('sync_error', err.message);

    try {
      const pool = await connectDB();
      await pool.request()
        .input('value', JSON.stringify({
          success:   false,
          error:     err.message,
          timestamp: new Date().toISOString(),
        }))
        .query(`
          UPDATE dbo.tovaltech_settings
          SET value = @value, updated_at = GETDATE()
          WHERE key_name = 'last_sync_result'
        `);
    } catch (_) {}

    context.res = {
      status: 500, headers,
      body: { success: false, error: err.message },
    };
  }
};
