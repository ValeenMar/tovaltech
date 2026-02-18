// api/timers/import-sync/index.js
'use strict';

/**
 * TovalTech 2.0 — Auto-sync de precios de mayoristas
 *
 * Timer que se ejecuta según la config de cada proveedor:
 *   - Elit  → diario a las 06:00 UTC (precio se actualiza lunes/jueves en Elit)
 *   - NB    → semanal (archivo manual; el timer intenta si hay URL configurada)
 *
 * Se puede configurar con:
 *   IMPORT_SYNC_ELIT_ENABLED = 'true' | 'false'  (default: 'true')
 *   IMPORT_SYNC_NB_ENABLED   = 'true' | 'false'  (default: 'false' porque NB es XLSX manual)
 *
 * El timer corre todos los días a las 06:00 UTC y decide internamente
 * qué fuentes sincronizar según la config.
 */

const { app } = require('@azure/functions');
const db       = require('../../shared/db');
const { getCurrentFxRate }                       = require('../../shared/fx');
const { fetchElitProducts, upsertElitProducts }  = require('../../shared/importers/elit');
const { fetchNbProducts, upsertNbProducts }      = require('../../shared/importers/nb');

app.timer('importSync', {
  // Todos los días a las 06:00 UTC
  schedule:     '0 0 6 * * *',
  runOnStartup: false,

  handler: async (myTimer, context) => {
    const startedAt = new Date();
    context.log(JSON.stringify({
      level: 'info', message: 'import-sync: timer fired', startedAt: startedAt.toISOString(), isPastDue: myTimer.isPastDue,
    }));

    const elitEnabled = process.env.IMPORT_SYNC_ELIT_ENABLED !== 'false';
    const nbEnabled   = process.env.IMPORT_SYNC_NB_ENABLED   === 'true';

    const results = {};

    // ── Elit sync ────────────────────────────────────────────────────────────
    if (elitEnabled) {
      const elitProviderId = parseInt(process.env.ELIT_PROVIDER_ID || '0', 10);
      if (!elitProviderId) {
        context.log(JSON.stringify({ level: 'warn', message: 'import-sync: ELIT_PROVIDER_ID no configurado — saltando Elit' }));
      } else {
        try {
          const products = await fetchElitProducts();
          const result   = await upsertElitProducts(db, elitProviderId, products);
          results.elit   = { status: 'success', ...result };
          context.log(JSON.stringify({ level: 'info', message: 'import-sync: Elit OK', ...result }));
        } catch (err) {
          results.elit = { status: 'error', error: err.message };
          context.log(JSON.stringify({ level: 'error', message: 'import-sync: Elit FAILED', error: err.message }));
        }
      }
    } else {
      context.log(JSON.stringify({ level: 'info', message: 'import-sync: Elit deshabilitado (IMPORT_SYNC_ELIT_ENABLED=false)' }));
    }

    // ── NB sync ───────────────────────────────────────────────────────────────
    if (nbEnabled) {
      const nbProviderId = parseInt(process.env.NB_PROVIDER_ID || '0', 10);
      if (!nbProviderId) {
        context.log(JSON.stringify({ level: 'warn', message: 'import-sync: NB_PROVIDER_ID no configurado — saltando NB' }));
      } else {
        try {
          let fxRate = null;
          if ((process.env.NB_PRICE_CURRENCY || 'USD').toUpperCase() === 'ARS') {
            const fx = await getCurrentFxRate();
            fxRate = fx?.rate ?? null;
          }
          const products = await fetchNbProducts();
          const result   = await upsertNbProducts(db, nbProviderId, products, fxRate);
          results.nb     = { status: 'success', ...result };
          context.log(JSON.stringify({ level: 'info', message: 'import-sync: NB OK', ...result }));
        } catch (err) {
          results.nb = { status: 'error', error: err.message };
          context.log(JSON.stringify({ level: 'error', message: 'import-sync: NB FAILED', error: err.message }));
        }
      }
    } else {
      context.log(JSON.stringify({ level: 'info', message: 'import-sync: NB deshabilitado (IMPORT_SYNC_NB_ENABLED no es true)' }));
    }

    const durationMs = Date.now() - startedAt.getTime();
    context.log(JSON.stringify({ level: 'info', message: 'import-sync: finished', durationMs, results }));

    // Si alguno falló, lanzar error para que Azure Functions lo marque como Failed
    const anyError = Object.values(results).some((r) => r.status === 'error');
    if (anyError) {
      throw new Error(`import-sync: uno o más proveedores fallaron. Ver logs. ${JSON.stringify(results)}`);
    }
  },
});
