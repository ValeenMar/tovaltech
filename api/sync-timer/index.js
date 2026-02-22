// api/sync-timer/index.js
// HTTP Trigger — corre el sync de mayoristas automáticamente.
//
// Azure Static Web Apps no soporta timerTrigger, así que este endpoint
// se llama desde cron-job.org (gratis) todos los días a las 8am Argentina.
//
// Setup en cron-job.org:
//   URL:    https://www.tovaltech.com.ar/api/sync-timer?secret=TU_CRON_SECRET
//   Método: GET
//   Hora:   11:00 UTC (= 08:00 Argentina UTC-3)
//   Días:   todos
//
// Agregá CRON_SECRET en Azure → Configuration → Application settings.

const syncHandler = require('../sync/index.js');
const { getTraceId, logWithTrace } = require('../_shared/trace');
const { sendJson } = require('../_shared/http');

module.exports = async function (context, req) {
  const traceId = getTraceId(req);
  // Verificar secret para que solo cron-job.org pueda dispararlo
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    sendJson(context, {
      status: 500,
      traceId,
      body: { error: 'config_missing', trace_id: traceId },
    });
    return;
  }

  const provided = req.query?.secret || req.headers?.['x-cron-secret'];
  if (provided !== secret) {
    sendJson(context, {
      status: 401,
      traceId,
      body: { error: 'unauthorized', trace_id: traceId },
    });
    return;
  }

  logWithTrace(context, 'info', traceId, 'sync_timer_start', { source: 'external_cron' });

  const fakeReq = { body: {}, query: {}, method: 'POST', headers: { 'x-trace-id': traceId } };
  await syncHandler(context, fakeReq);

  logWithTrace(context, 'info', traceId, 'sync_timer_complete');
};
