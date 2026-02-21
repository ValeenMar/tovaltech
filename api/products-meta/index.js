// api/products-meta/index.js
// Devuelve categorías (con jerarquía padre/hijo), marcas y proveedores.
// Endpoint público — usado por la tienda para armar filtros y subcategorías.

const connectDB = require('../db');

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const q = `
      -- Categorías con jerarquía (incluyendo parent_id si existe la columna)
      SELECT
        c.id,
        c.name,
        c.parent_id,
        COUNT(p.id) AS product_count
      FROM dbo.tovaltech_categories c
      LEFT JOIN dbo.tovaltech_products p
        ON p.category = c.name AND p.stock > 0 AND (p.active IS NULL OR p.active = 1)
      GROUP BY c.id, c.name, c.parent_id
      ORDER BY c.name ASC;

      -- Marcas distintas
      SELECT DISTINCT brand AS v
      FROM dbo.tovaltech_products
      WHERE brand IS NOT NULL AND LTRIM(RTRIM(brand)) <> ''
      ORDER BY v;

      -- Proveedores distintos
      SELECT DISTINCT provider AS v
      FROM dbo.tovaltech_products
      WHERE provider IS NOT NULL AND LTRIM(RTRIM(provider)) <> ''
      ORDER BY v;

      -- Subcategorías distintas por categoria (para chips de filtro en la tienda)
      SELECT DISTINCT category AS cat, subcategory AS sub
      FROM dbo.tovaltech_products
      WHERE subcategory IS NOT NULL
        AND LTRIM(RTRIM(subcategory)) <> ''
        AND stock > 0
        AND (active IS NULL OR active = 1)
      ORDER BY cat, sub;
    `;

    const result = await pool.request().query(q);

    // Armar árbol de categorías
    const allCats = result.recordsets[0] || [];
    const parents = allCats.filter(c => !c.parent_id);
    const children = allCats.filter(c => c.parent_id);

    const categoryTree = parents.map(p => ({
      id:            p.id,
      name:          p.name,
      product_count: p.product_count,
      children:      children
        .filter(c => c.parent_id === p.id)
        .map(c => ({ id: c.id, name: c.name, product_count: c.product_count })),
    }));

    // Lista plana de categorías (compatibilidad con código existente)
    const categories = parents.map(p => p.name);

    // Mapa subcategorías: { "Placa De Video": ["NVIDIA", "AMD"], ... }
    const subcategoryMap = {};
    for (const row of (result.recordsets[3] || [])) {
      if (!subcategoryMap[row.cat]) subcategoryMap[row.cat] = [];
      if (!subcategoryMap[row.cat].includes(row.sub)) {
        subcategoryMap[row.cat].push(row.sub);
      }
    }

    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        categories,
        categoryTree,
        subcategoryMap,
        brands:    (result.recordsets[1] || []).map(r => r.v),
        providers: (result.recordsets[2] || []).map(r => r.v),
      },
    };
  } catch (err) {
    context.log.error('products_meta_failed', err);
    context.res = {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: { error: 'products_meta_failed', message: err.message },
    };
  }
};
