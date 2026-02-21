// api/health/index.js
// Verifica que la conexión a la base de datos esté activa.
// Protegido con allowedRoles: ["admin"] en staticwebapp.config.json.

const connectDB = require('../db');

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();
    const r    = await pool.request().query('SELECT 1 AS ok');
    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        ok: true,
        db: r.recordset?.[0]?.ok === 1,
      },
    };
  } catch (err) {
    context.log.error('health_check_failed', err.message);
    context.res = {
      status: 500,
      headers: { 'content-type': 'application/json' },
      // No exponemos el mensaje de error ni el stack al exterior
      body: { ok: false },
    };
  }
};
