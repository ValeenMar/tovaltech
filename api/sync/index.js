const fetch = require('node-fetch');
const connectDB = require('../db');
const sql = require('mssql');

// ─── OBTENER DÓLAR OFICIAL BNA ───────────────────────────────────────────────
async function getDolarOficial() {
  const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
  const data = await res.json();
  return data.venta;
}

// ─── PARSEAR CSV NEWBYTES (separador ;) ─────────────────────────────────────
function parseNewBytes(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].replace(/"/g, '').split(';').map(h => h.trim());

  return lines.slice(1).map(line => {
    const cols = [];
    let current = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ';' && !inQuote) { cols.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    cols.push(current.trim());

    const row = {};
    headers.forEach((h, i) => row[h] = cols[i] || '');

    const priceUsd = parseFloat(row['PRECIO FINAL']) || 0;
    const stockRaw = parseInt(row['STOCK']) || 0;

    return {
      sku:       row['CODIGO'],
      name:      row['DETALLE'] || row['DETALLE_USUARIO'],
      category:  row['CATEGORIA'],
      brand:     row['MARCA'],
      price_usd: priceUsd,
      stock:     stockRaw,
      image_url: row['IMAGEN'],
      provider:  'newbytes',
      warranty:  row['GARANTIA'] || '12 meses',
    };
  }).filter(p => p.sku && p.name && p.price_usd > 0);
}

// ─── PARSEAR CSV ELIT (separador ,) ─────────────────────────────────────────
function parseElit(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const cols = [];
    let current = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { cols.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    cols.push(current.trim());

    const row = {};
    headers.forEach((h, i) => row[h] = cols[i] || '');

    const priceUsd = parseFloat(row['pvp_usd']) || 0;
    const stockTotal = parseInt(row['stock_total']) || 0;

    return {
      sku:       row['codigo_alfa'] || row['codigo_producto'],
      name:      row['nombre'],
      category:  row['categoria'],
      brand:     row['marca'],
      price_usd: priceUsd,
      stock:     stockTotal,
      image_url: row['imagen'],
      provider:  'elit',
      warranty:  row['garantia'] || '12 meses',
    };
  }).filter(p => p.sku && p.name && p.price_usd > 0);
}

// ─── UPSERT PRODUCTO EN SQL ───────────────────────────────────────────────────
async function upsertProduct(pool, product, dolarVenta) {
  const priceArs = Math.round(product.price_usd * dolarVenta);

  await pool.request()
    .input('sku',        sql.NVarChar, product.sku)
    .input('name',       sql.NVarChar, product.name.substring(0, 300))
    .input('category',   sql.NVarChar, product.category)
    .input('brand',      sql.NVarChar, product.brand)
    .input('price_usd',  sql.Decimal(10, 2), product.price_usd)
    .input('price_ars',  sql.Int, priceArs)
    .input('stock',      sql.Int, product.stock)
    .input('image_url',  sql.NVarChar, product.image_url)
    .input('provider',   sql.NVarChar, product.provider)
    .input('warranty',   sql.NVarChar, product.warranty)
    .input('dolar_rate', sql.Decimal(10, 2), dolarVenta)
    .query(`
      MERGE tovaltech_products AS target
      USING (SELECT @sku AS sku) AS source ON target.sku = source.sku
      WHEN MATCHED THEN UPDATE SET
        name       = @name,
        category   = @category,
        brand      = @brand,
        price_usd  = @price_usd,
        price_ars  = @price_ars,
        stock      = @stock,
        image_url  = @image_url,
        provider   = @provider,
        warranty   = @warranty,
        dolar_rate = @dolar_rate,
        updated_at = GETDATE()
      WHEN NOT MATCHED THEN INSERT
        (sku, name, category, brand, price_usd, price_ars, stock, image_url, provider, warranty, dolar_rate)
      VALUES
        (@sku, @name, @category, @brand, @price_usd, @price_ars, @stock, @image_url, @provider, @warranty, @dolar_rate);
    `);
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────
module.exports = async function (context, req) {
  const results = { elit: 0, newbytes: 0, errors: [], dolar: 0 };

  try {
    const pool = await connectDB();

    // 1. Dólar oficial BNA
    const dolarVenta = await getDolarOficial();
    results.dolar = dolarVenta;
    context.log(`Dólar oficial BNA: $${dolarVenta}`);

    // 2. ELIT
    try {
      const elitRes = await fetch('https://clientes.elit.com.ar/v1/api/productos/csv?user_id=29574&token=m04mv68iwb9');
      const elitCsv = await elitRes.text();
      const elitProducts = parseElit(elitCsv);
      context.log(`Elit: ${elitProducts.length} productos`);

      for (const product of elitProducts) {
        try {
          await upsertProduct(pool, product, dolarVenta);
          results.elit++;
        } catch (err) {
          results.errors.push(`ELIT ${product.sku}: ${err.message}`);
        }
      }
    } catch (err) {
      results.errors.push(`Error general ELIT: ${err.message}`);
    }

    // 3. NEWBYTES
    try {
      const nbRes = await fetch('https://api.nb.com.ar/v1/priceListCsv/c6caafe18ab17302a736431e21c9b5');
      const nbCsv = await nbRes.text();
      const nbProducts = parseNewBytes(nbCsv);
      context.log(`NewBytes: ${nbProducts.length} productos`);

      for (const product of nbProducts) {
        try {
          await upsertProduct(pool, product, dolarVenta);
          results.newbytes++;
        } catch (err) {
          results.errors.push(`NB ${product.sku}: ${err.message}`);
        }
      }
    } catch (err) {
      results.errors.push(`Error general NewBytes: ${err.message}`);
    }

    context.res = {
      status: 200,
      body: {
        success: true,
        dolar_oficial: dolarVenta,
        elit_sincronizados: results.elit,
        newbytes_sincronizados: results.newbytes,
        total: results.elit + results.newbytes,
        errores: results.errors.length,
        detalle_errores: results.errors.slice(0, 10)
      }
    };

  } catch (err) {
    context.log.error('ERROR SYNC:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message,
        stack: err.stack   // 👈 muestra el error exacto en el browser
      }
    };
  }
};