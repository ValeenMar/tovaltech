// api/sync-timer/index.js
// Timer Trigger — corre el sync de mayoristas automáticamente todos los días a las 8am UTC.
//
// No hace falta tocar nada en el código cuando cambian los precios de Elit o NewBytes:
// Azure lo corre solo y el resultado queda guardado en tovaltech_settings["last_sync_result"].
//
// Para cambiar el horario, editá el campo "schedule" en function.json.
// Formato CRON de Azure: "seg min hora día mes día-semana"
//   "0 0 8 * * *"  → todos los días a las 08:00 UTC (05:00 Argentina en verano, 05:00 UTC-3)
//   "0 0 11 * * *" → todos los días a las 08:00 Argentina (UTC-3)
//
// Variable de entorno extra que necesita Azure (además de las de la DB):
//   ELIT_API_URL    → URL de descarga del CSV de Elit
//   NEWBYTES_API_URL → URL de descarga del CSV de NewBytes

const syncHandler = require('../sync/index.js');

module.exports = async function (context, myTimer) {
  if (myTimer.isPastDue) {
    context.log.warn('sync_timer_past_due — el timer se disparó tarde, corriendo igual.');
  }

  context.log.info('sync_timer_start', { scheduledTime: myTimer.scheduleStatus?.last });

  // Reutilizamos exactamente el mismo handler del sync manual.
  // Le pasamos un req vacío porque el timer no tiene HTTP request.
  const fakeReq = { body: {}, query: {}, method: 'POST', headers: {} };

  await syncHandler(context, fakeReq);

  // El resultado ya lo guarda el handler en tovaltech_settings["last_sync_result"]
  // y también lo loguea. context.res quedará seteado pero Azure lo ignora en timers.
  context.log.info('sync_timer_complete');
};
