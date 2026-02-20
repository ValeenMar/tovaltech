/**
 * api/categories/index.js
 *
 * CRUD completo de categorías + asignación de productos.
 *
 * GET    /api/categories                    → lista categorías con conteo y markup
 * POST   /api/categories  { action: ... }   → acciones:
 *   action: 'create'  { name, markup_pct? }
 *   action: 'update'  { id, name?, markup_pct? }   // markup_pct: null = quita el custom
 *   action: 'delete'  { id, reassign_to? }          // reassign_to: nombre de categoría destino
 *   action: 'assign'  { product_ids: number[], category_name: string }
 */

const connectDB = require('../db');

const headers = { 'content-type': 'application/json' };

// Tabla correcta en tu SQL (según tu propia verificación y el contexto)
const CATS_TABLE = 'dbo.categories';

// ── GET ───────────────────────────────────────────────────────────────────────

async function getCategories(pool) {
  const result = await pool.request().query(`
    SELECT
      c.id,
      c.name,
      c.markup_pct,
      c.created_at,
      c.updated_at,
      COUNT(p.id) AS product_count
    FROM ${CATS_TABLE} c
    LEFT JOIN dbo.tovaltech_products p ON p.category = c.name
    GROUP BY c.id, c.name, c.markup_pct, c.created_at, c.updated_at
    ORDER BY c.name ASC;
  `);

  return result.recordset.map(r => ({
    id:            r.id,
    name:          r.name,
    markup_pct:    r.markup_pct !== null ? parseFloat(r.markup_pct) : null,
    product_count: r.product_count ?? 0,
    created_at:    r.created_at,
    updated_at:    r.updated_at,
  }));
}

// ── CREATE ────────────────────────────────────────────────────────────────────

async function createCategory(pool, { name, markup_pct }) {
  if (!name || !String(name).trim()) {
    return { status: 400, body: { error: 'El nombre es requerido.' } };
  }

  const cleanName   = String(name).trim();
  const cleanMarkup = markup_pct !== undefined && markup_pct !== null && markup_pct !== ''
    ? parseFloat(markup_pct)
    : null;

  if (cleanMarkup !== null && (!Number.isFinite(cleanMarkup) || cleanMarkup < 0 || cleanMarkup > 500)) {
    return { status: 400, body: { error: 'markup_pct debe estar entre 0 y 500.' } };
  }

  // Verificar unicidad
  const exists = await pool.request()
    .input('name', cleanName)
    .query(`SELECT id FROM ${CATS_TABLE} WHERE name = @name`);

  if (exists.recordset.length) {
    return { status: 409, body: { error: `La categoría "${cleanName}" ya existe.` } };
  }

  const result = await pool.request()
    .input('name',       cleanName)
    .input('markup_pct', cleanMarkup)
    .query(`
      INSERT INTO ${CATS_TABLE} (name, markup_pct)
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.markup_pct, INSERTED.created_at
      VALUES (@name, @markup_pct);
    `);

  const row = result.recordset[0];
  return {
    status: 201,
    body: {
      success: true,
      category: {
        id:            row.id,
        name:          row.name,
        markup_pct:    row.markup_pct !== null ? parseFloat(row.markup_pct) : null,
        product_count: 0,
        created_at:    row.created_at,
      },
    },
  };
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

async function updateCategory(pool, { id, name, markup_pct }) {
  if (!id) return { status: 400, body: { error: 'id requerido.' } };

  const numId = parseInt(id, 10);

  // Verificar que existe
  const existing = await pool.request()
    .input('id', numId)
    .query(`SELECT id, name FROM ${CATS_TABLE} WHERE id = @id`);

  if (!existing.recordset.length) {
    return { status: 404, body: { error: 'Categoría no encontrada.' } };
  }

  const currentName = existing.recordset[0].name;

  // Calcular nuevos valores
  const newName = name !== undefined ? String(name).trim() : currentName;

  // markup_pct: null explícito = quitar custom (usa global), '' = idem, número = setear
  let newMarkup;
  if (markup_pct === null || markup_pct === '' || markup_pct === undefined) {
    newMarkup = null;
  } else {
    newMarkup = parseFloat(markup_pct);
    if (!Number.isFinite(newMarkup) || newMarkup < 0 || newMarkup > 500) {
      return { status: 400, body: { error: 'markup_pct debe estar entre 0 y 500.' } };
    }
  }

  // Si cambió el nombre, actualizar también los productos
  if (newName !== currentName) {
    const nameExists = await pool.request()
      .input('name', newName)
      .input('id',   numId)
      .query(`SELECT id FROM ${CATS_TABLE} WHERE name = @name AND id <> @id`);

    if (nameExists.recordset.length) {
      return { status: 409, body: { error: `La categoría "${newName}" ya existe.` } };
    }

    // Actualizar productos que tenían el nombre viejo
    await pool.request()
      .input('newName',  newName)
      .input('oldName',  currentName)
      .query(`UPDATE dbo.tovaltech_products SET category = @newName WHERE category = @oldName`);
  }

  await pool.request()
    .input('id',         numId)
    .input('name',       newName)
    .input('markup_pct', newMarkup)
    .query(`
      UPDATE ${CATS_TABLE}
      SET name = @name, markup_pct = @markup_pct, updated_at = GETDATE()
      WHERE id = @id
    `);

  return { status: 200, body: { success: true, id: numId, name: newName, markup_pct: newMarkup } };
}

// ── DELETE ────────────────────────────────────────────────────────────────────

async function deleteCategory(pool, { id, reassign_to }) {
  if (!id) return { status: 400, body: { error: 'id requerido.' } };

  const numId = parseInt(id, 10);

  const existing = await pool.request()
    .input('id', numId)
    .query(`SELECT id, name FROM ${CATS_TABLE} WHERE id = @id`);

  if (!existing.recordset.length) {
    return { status: 404, body: { error: 'Categoría no encontrada.' } };
  }

  const catName = existing.recordset[0].name;

  // Reasignar productos si se pidió
  if (reassign_to) {
    // Verificar que la categoría destino exista
    const dest = await pool.request()
      .input('name', reassign_to)
      .query(`SELECT id FROM ${CATS_TABLE} WHERE name = @name`);

    if (!dest.recordset.length) {
      return { status: 404, body: { error: `La categoría destino "${reassign_to}" no existe.` } };
    }

    await pool.request()
      .input('newCat', reassign_to)
      .input('oldCat', catName)
      .query(`UPDATE dbo.tovaltech_products SET category = @newCat WHERE category = @oldCat`);
  }

  await pool.request()
    .input('id', numId)
    .query(`DELETE FROM ${CATS_TABLE} WHERE id = @id`);

  return {
    status: 200,
    body: { success: true, deleted: catName, reassigned_to: reassign_to ?? null },
  };
}

// ── ASSIGN PRODUCTS ───────────────────────────────────────────────────────────

async function assignProducts(pool, { product_ids, category_name }) {
  if (!Array.isArray(product_ids) || !product_ids.length) {
    return { status: 400, body: { error: 'product_ids debe ser un array no vacío.' } };
  }
  if (!category_name && category_name !== '') {
    return { status: 400, body: { error: 'category_name requerido.' } };
  }

  const cleanCat = String(category_name).trim();

  // Verificar que la categoría existe (salvo que sea vacío = desasignar)
  if (cleanCat) {
    const exists = await pool.request()
      .input('name', cleanCat)
      .query(`SELECT id FROM ${CATS_TABLE} WHERE name = @name`);
    if (!exists.recordset.length) {
      return { status: 404, body: { error: `Categoría "${cleanCat}" no encontrada.` } };
    }
  }

  const validIds = product_ids.map(id => parseInt(id, 10)).filter(n => Number.isFinite(n));
  if (!validIds.length) {
    return { status: 400, body: { error: 'Ningún ID de producto válido.' } };
  }

  const idList = validIds.join(',');

  await pool.request()
    .input('category', cleanCat || null)
    .query(`
      UPDATE dbo.tovaltech_products
      SET category = @category, updated_at = GETDATE()
      WHERE id IN (${idList})
    `);

  return {
    status: 200,
    body: { success: true, updated_count: validIds.length, category: cleanCat || null },
  };
}

// ── GET PRODUCTS (para el selector del admin) ─────────────────────────────────

async function getProductsForAssign(pool, { search, category, limit = 100, offset = 0 }) {
  const where = [];
  const req   = pool.request();

  if (search) {
    where.push(`(name LIKE @search OR brand LIKE @search OR sku LIKE @search)`);
    req.input('search', `%${search}%`);
  }

  if (category === '__none__') {
    where.push(`(category IS NULL OR LTRIM(RTRIM(category)) = '')`);
  } else if (category) {
    req.input('category', category);
    where.push(`category = @category`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  req.input('limit',  Math.min(parseInt(limit, 10) || 100, 500));
  req.input('offset', Math.max(parseInt(offset, 10) || 0, 0));

  const result = await req.query(`
    SELECT id, name, brand, category, stock, sku, image_url
    FROM dbo.tovaltech_products
    ${whereSql}
    ORDER BY name ASC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `);

  const countReq = pool.request();
  if (search) countReq.input('search', `%${search}%`);
  if (category && category !== '__none__') countReq.input('category', category);

  const countRes = await countReq.query(
    `SELECT COUNT(1) AS total FROM dbo.tovaltech_products ${whereSql}`
  );

  return {
    status: 200,
    body: {
      products: result.recordset,
      total:    countRes.recordset[0]?.total ?? 0,
    },
  };
}

// ── Handler principal ─────────────────────────────────────────────────────────

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    if (req.method === 'GET') {
      if (req.query.mode === 'products') {
        const r = await getProductsForAssign(pool, {
          search:   req.query.search,
          category: req.query.category,
          limit:    req.query.limit,
          offset:   req.query.offset,
        });
        context.res = { status: r.status, headers, body: r.body };
        return;
      }

      const cats = await getCategories(pool);
      context.res = { status: 200, headers, body: { categories: cats } };
      return;
    }

    if (req.method === 'POST') {
      const body   = req.body ?? {};
      const action = body.action;

      let result;
      switch (action) {
        case 'create':  result = await createCategory(pool, body); break;
        case 'update':  result = await updateCategory(pool, body); break;
        case 'delete':  result = await deleteCategory(pool, body); break;
        case 'assign':  result = await assignProducts(pool, body); break;
        default:
          result = { status: 400, body: { error: `Acción desconocida: "${action}". Válidas: create, update, delete, assign.` } };
      }

      context.res = { status: result.status, headers, body: result.body };
      return;
    }

    context.res = { status: 405, headers, body: { error: 'Method not allowed' } };

  } catch (err) {
    context.log.error('categories_error', err.message, err.stack);
    context.res = {
      status: 500, headers,
      body: { error: 'categories_failed', message: err.message },
    };
  }
};