// api/health/index.js
// Verifica que la conexión a la base de datos esté activa.
// Protegido con allowedRoles: ["admin"] en staticwebapp.config.json.

const connectDB = require('../db');
const { getTraceId } = require('../_shared/trace');

module.exports = async function (context, req) {
  const traceId = getTraceId(req);
  try {
    const pool = await connectDB();
    const r    = await pool.request().query('SELECT 1 AS ok');
    const checks = {
      mp_access_token: Boolean(process.env.MP_ACCESS_TOKEN),
      mp_webhook_secret: Boolean(process.env.MP_WEBHOOK_SECRET),
      cron_secret: Boolean(process.env.CRON_SECRET),
      web3forms_access_key: Boolean(process.env.WEB3FORMS_ACCESS_KEY),
      jwt_secret: Boolean(process.env.JWT_SECRET),
      db_server: Boolean(process.env.DB_SERVER),
      db_name: Boolean(process.env.DB_NAME),
      db_user: Boolean(process.env.DB_USER),
      db_password: Boolean(process.env.DB_PASSWORD),
    };
    const configOk = Object.values(checks).every(Boolean);
    const dbOk = r.recordset?.[0]?.ok === 1;

    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        ok: dbOk && configOk,
        trace_id: traceId,
        db: dbOk,
        config_ok: configOk,
        checks,
      },
    };
  } catch (err) {
    context.log.error('health_check_failed', err.message);
    context.res = {
      status: 500,
      headers: { 'content-type': 'application/json' },
      // No exponemos el mensaje de error ni el stack al exterior
      body: { ok: false, trace_id: traceId },
    };
  }
};
