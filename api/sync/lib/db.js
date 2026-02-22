const sql = require('mssql');

async function mergeProducts(pool, products) {
  if (!products.length) return { inserted: 0, updated: 0, total: 0 };

  await pool.request().query('TRUNCATE TABLE dbo.tovaltech_staging');

  const table = new sql.Table('dbo.tovaltech_staging');
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
      p.sku, p.name, p.category, p.brand,
      p.price_usd, p.price_ars, p.stock,
      p.image_url, p.provider, p.warranty, p.dolar_rate,
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
        t.image_url  = ISNULL(t.image_url, s.image_url),
        t.provider   = s.provider,
        t.warranty   = s.warranty,
        t.dolar_rate = s.dolar_rate,
        t.updated_at = GETDATE()
    WHEN NOT MATCHED THEN
      INSERT (sku, name, category, brand, price_usd, price_ars, stock,
              image_url, provider, warranty, dolar_rate, active, featured, created_at, updated_at)
      VALUES (s.sku, s.name, s.category, s.brand, s.price_usd, s.price_ars, s.stock,
              s.image_url, s.provider, s.warranty, s.dolar_rate,
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
    inserted: Number.parseInt(row.inserted || 0, 10),
    updated: Number.parseInt(row.updated || 0, 10),
    total: Number.parseInt(row.total || 0, 10),
  };
}

async function syncNewCategories(pool, products) {
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
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

module.exports = {
  mergeProducts,
  syncNewCategories,
  chunk,
};
