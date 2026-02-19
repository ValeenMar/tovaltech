const connectDB = require('../db');

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    if (req.method === 'GET') {
      const { categoria, marca, proveedor, buscar, limit = 50, offset = 0 } = req.query;

      let query = 'SELECT * FROM tovaltech_products WHERE stock > 0';
      if (categoria) query += ` AND category = '${categoria}'`;
      if (marca)     query += ` AND brand = '${marca}'`;
      if (proveedor) query += ` AND provider = '${proveedor}'`;
      if (buscar)    query += ` AND (name LIKE '%${buscar}%' OR brand LIKE '%${buscar}%')`;
      query += ` ORDER BY updated_at DESC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

      const result = await pool.request().query(query);
      context.res = { status: 200, body: result.recordset };
    }

  } catch (err) {
    context.res = { status: 500, body: { error: err.message } };
  }
};