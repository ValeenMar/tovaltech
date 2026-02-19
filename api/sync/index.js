const fetch = require('node-fetch');
const sql = require('mssql');
const connectDB = require('../db');

const ELIT_URL = 'https://clientes.elit.com.ar/v1/api/productos/csv?user_id=29574&token=m04mv68iwb9';
const NEWBYTES_URL = 'https://api.nb.com.ar/v1/priceListCsv/c6caafe18ab17302a736431e21c9b5';
const DOLAR_URL = 'https://dolarapi.com/v1/dolares/oficial';

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, '').replace(',', '.'); // tolerate 1.234,56
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
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (c === '\n') {
      row.push(field);
      field = '';
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

function mapElit(row, dolar) {
  const sku = normalizeText(row.codigo_alfa);
  const name = normalizeText(row.nombre);
  const category = normalizeText(row.categoria);
  const brand = normalizeText(row.marca);
  const priceUsd = parseNumber(row.pvp_usd);
  const stock = parseIntSafe(row.stock_total, 0);
  const imageUrl = normalizeText(row.imagen);
  const warranty = normalizeText(row.garantia);

  if (!sku || !name || !priceUsd) return null;

  return {
    sku,
    name,
    category,
    brand,
    price_usd: round2(priceUsd),
    price_ars: Math.max(0, Math.round(priceUsd * dolar)),
    stock,
    image_url: imageUrl,
    provider: 'elit',
    warranty,
    dolar_rate: round2(dolar),
  };
}

function mapNewBytes(row, dolar) {
  const sku      = normalizeText(row.CODIGO);
  // Preferir DETALLE_USUARIO si está disponible (nombre personalizado del cliente)
  const name     = normalizeText(row.DETALLE_USUARIO || row.DETALLE);
  // Preferir CATEGORIA_USUARIO si está disponible
  const category = normalizeText(row.CATEGORIA_USUARIO || row.CATEGORIA);
  const brand    = normalizeText(row.MARCA);
  // Usar campos CON UTILIDAD que ya tienen markup aplicado
  const priceUsd = parseNumber(row['PRECIO USD CON UTILIDAD'] || row['PRECIO FINAL']);
  const priceArs = parseNumber(row['PRECIO PESOS CON UTILIDAD'] || row['PRECIO PESOS CON IVA']);
  const stock    = parseIntSafe(row.STOCK, 0);
  const imageUrl = normalizeText(row.IMAGEN);
  const warranty = normalizeText(row.GARANTIA);

  if (!sku || !name || !priceUsd) return null;

  return {
    sku,
    name,
    category,
    brand,
    price_usd: round2(priceUsd),
    price_ars: Math.max(0, Math.round(priceArs ?? priceUsd * dolar)),
    stock,
    image_url: imageUrl,
    provider: 'newbytes',
    warranty,
    dolar_rate: round2(dolar),
  };
}

async function mergeProducts(pool, products) {
  if (!products.length) return { inserted: 0, updated: 0, total: 0 };

  await pool.request().batch(`
    IF OBJECT_ID('tempdb..#staging_products') IS NOT NULL DROP TABLE #staging_products;
    CREATE TABLE #staging_products (
      sku NVARCHAR(100) NOT NULL,
      name NVARCHAR(300) NOT NULL,
      category NVARCHAR(100) NULL,
      brand NVARCHAR(100) NULL,
      price_usd DECIMAL(10,2) NOT NULL,
      price_ars INT NOT NULL,
      stock INT NOT NULL,
      image_url NVARCHAR(500) NULL,
      provider NVARCHAR(20) NULL,
      warranty NVARCHAR(50) NULL,
      dolar_rate DECIMAL(10,2) NULL
    );
  `);

  const table = new sql.Table('#staging_products');
  table.create = false;
  table.columns.add('sku', sql.NVarChar(100), { nullable: false });
  table.columns.add('name', sql.NVarChar(300), { nullable: false });
  table.columns.add('category', sql.NVarChar(100), { nullable: true });
  table.columns.add('brand', sql.NVarChar(100), { nullable: true });
  table.columns.add('price_usd', sql.Decimal(10, 2), { nullable: false });
  table.columns.add('price_ars', sql.Int, { nullable: false });
  table.columns.add('stock', sql.Int, { nullable: false });
  table.columns.add('image_url', sql.NVarChar(500), { nullable: true });
  table.columns.add('provider', sql.NVarChar(20), { nullable: true });
  table.columns.add('warranty', sql.NVarChar(50), { nullable: true });
  table.columns.add('dolar_rate', sql.Decimal(10, 2), { nullable: true });

  for (const p of products) {
    table.rows.add(
      p.sku,
      p.name,
      p.category,
      p.brand,
      p.price_usd,
      p.price_ars,
      p.stock,
      p.image_url,
      p.provider,
      p.warranty,
      p.dolar_rate
    );
  }

  await pool.request().bulk(table);

  const result = await pool.request().query(`
    DECLARE @merge_output TABLE(action NVARCHAR(10));

    MERGE tovaltech_products AS t
    USING #staging_products AS s
      ON t.sku = s.sku
    WHEN MATCHED THEN
      UPDATE SET
        t.name = s.name,
        t.category = s.category,
        t.brand = s.brand,
        t.price_usd = s.price_usd,
        t.price_ars = s.price_ars,
        t.stock = s.stock,
        t.image_url = s.image_url,
        t.provider = s.provider,
        t.warranty = s.warranty,
        t.dolar_rate = s.dolar_rate,
        t.updated_at = GETDATE()
    WHEN NOT MATCHED THEN
      INSERT (sku, name, category, brand, price_usd, price_ars, stock, image_url, provider, warranty, dolar_rate, featured, created_at, updated_at)
      VALUES (s.sku, s.name, s.category, s.brand, s.price_usd, s.price_ars, s.stock, s.image_url, s.provider, s.warranty, s.dolar_rate, 0, GETDATE(), GETDATE())
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
    updated: parseInt(row.updated || 0, 10),
    total: parseInt(row.total || 0, 10),
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports = async function (context, req) {
  try {
    const dolarPayload = await fetchJson(DOLAR_URL);
    const dolar = parseNumber(dolarPayload?.venta);
    if (!dolar) throw new Error('No se pudo obtener cotización dólar (campo venta)');

    const [elitCsv, nbCsv] = await Promise.all([
      fetchText(ELIT_URL),
      fetchText(NEWBYTES_URL),
    ]);

    const elitObjs = rowsToObjects(parseCsv(elitCsv, ','));
    const nbObjs = rowsToObjects(parseCsv(nbCsv, ';'));

    const elitProducts = elitObjs.map((r) => mapElit(r, dolar)).filter(Boolean);
    const nbProducts = nbObjs.map((r) => mapNewBytes(r, dolar)).filter(Boolean);

    const pool = await connectDB();

    let elitMerged = { inserted: 0, updated: 0, total: 0 };
    let nbMerged = { inserted: 0, updated: 0, total: 0 };

    for (const ch of chunk(elitProducts, 2000)) {
      const r = await mergeProducts(pool, ch);
      elitMerged = {
        inserted: elitMerged.inserted + r.inserted,
        updated: elitMerged.updated + r.updated,
        total: elitMerged.total + r.total,
      };
    }

    for (const ch of chunk(nbProducts, 2000)) {
      const r = await mergeProducts(pool, ch);
      nbMerged = {
        inserted: nbMerged.inserted + r.inserted,
        updated: nbMerged.updated + r.updated,
        total: nbMerged.total + r.total,
      };
    }

    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        success: true,
        dolar_oficial: dolar,
        elit: { ...elitMerged, parsed: elitProducts.length },
        newbytes: { ...nbMerged, parsed: nbProducts.length },
        total: elitMerged.total + nbMerged.total,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: { success: false, error: err.message, stack: err.stack },
    };
  }
};
