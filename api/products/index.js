const connectDB = require('../db');

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const {
      categoria,
      marca,
      proveedor,
      buscar,
      limit = 50,
      offset = 0,
    } = req.query || {};

    const safeLimit = Math.min(Math.max(toInt(limit, 50), 1), 200);
    const safeOffset = Math.max(toInt(offset, 0), 0);

    const where = ['stock > 0'];
    const request = pool.request();

    if (categoria) {
      where.push('category = @categoria');
      request.input('categoria', categoria);
    }
    if (marca) {
      where.push('brand = @marca');
      request.input('marca', marca);
    }
    if (proveedor) {
      where.push('provider = @proveedor');
      request.input('proveedor', proveedor);
    }
    if (buscar) {
      where.push('(name LIKE @buscar OR brand LIKE @buscar)');
      request.input('buscar', `%${buscar}%`);
    }

    request.input('limit', safeLimit);
    request.input('offset', safeOffset);

    const query = `
      SELECT *
      FROM tovaltech_products
      WHERE ${where.join(' AND ')}
      ORDER BY featured DESC, updated_at DESC, id DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await request.query(query);

    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: result.recordset,
    };
  } catch (err) {
    context.res = { status: 500, body: { error: err.message } };
  }
};
