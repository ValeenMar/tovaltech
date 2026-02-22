// api/health/index.js
// Verifica que la conexión a la base de datos esté activa.
// Protegido con allowedRoles: ["admin"] en staticwebapp.config.json.

const connectDB = require('../db');
const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');

module.exports = async function (context, req) {
  const traceId = getTraceId(req);
  const startedAt = Date.now();
  try {
    const pool = await connectDB();
    const r = await pool.request().query('SELECT 1 AS ok');
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
    const optionalChecks = {
      checkout_quote_ttl_min: Boolean(process.env.CHECKOUT_QUOTE_TTL_MIN),
      openai_api_key: Boolean(process.env.OPENAI_API_KEY),
      create_preference_rate_limit: Boolean(process.env.CREATE_PREFERENCE_RATE_LIMIT),
    };
    const configOk = Object.values(checks).every(Boolean);
    const dbOk = r.recordset?.[0]?.ok === 1;
    const latencyMs = Date.now() - startedAt;

    sendJson(context, {
      status: 200,
      traceId,
      body: {
        ok: dbOk && configOk,
        trace_id: traceId,
        db: dbOk,
        config_ok: configOk,
        checks,
        optional_checks: optionalChecks,
        runtime: {
          node: process.version,
          uptime_sec: Math.round(process.uptime()),
        },
        latency_ms: latencyMs,
      },
    });
  } catch (err) {
    logWithTrace(context, 'error', traceId, 'health_check_failed', { error: err.message });
    sendJson(context, {
      status: 500,
      traceId,
      body: { ok: false, trace_id: traceId },
    });
  }
};
