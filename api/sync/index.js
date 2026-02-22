const fetch = require('node-fetch');
const connectDB = require('../db');
const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');
const { parseNumber } = require('./lib/common');
const { mergeProducts, syncNewCategories, chunk } = require('./lib/db');
const { fetchElitProducts } = require('./providers/elit');
const { fetchNewBytesProducts } = require('./providers/newbytes');
const { fetchInvidProducts } = require('./providers/invid');

const ELIT_URL = process.env.ELIT_API_URL;
const NEWBYTES_URL = process.env.NEWBYTES_API_URL;
const INVID_USER = process.env.INVID_USER;
const INVID_PASS = process.env.INVID_PASS;
const DOLAR_URL = 'https://dolarapi.com/v1/dolares/oficial';

async function fetchDolar() {
  const res = await fetch(DOLAR_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${DOLAR_URL}`);
  return res.json();
}

module.exports = async function (context, req) {
  const traceId = getTraceId(req);
  const startTime = Date.now();

  if (!ELIT_URL || !NEWBYTES_URL) {
    sendJson(context, {
      status: 500,
      traceId,
      body: {
        success: false,
        error: 'config_missing',
        message: 'Faltan variables ELIT_API_URL o NEWBYTES_API_URL',
        trace_id: traceId,
      },
    });
    return;
  }

  const hasInvid = Boolean(INVID_USER && INVID_PASS);
  logWithTrace(context, 'info', traceId, 'sync_start', { invid_enabled: hasInvid });

  try {
    let dolar = 1400;
    try {
      const dolarData = await fetchDolar();
      dolar = parseNumber(dolarData?.venta) ?? parseNumber(dolarData?.promedio) ?? dolar;
    } catch (dolarErr) {
      logWithTrace(context, 'warn', traceId, 'sync_dolar_fallback', {
        error: dolarErr.message,
        fallback: dolar,
      });
    }

    const sources = [
      fetchElitProducts(ELIT_URL, dolar),
      fetchNewBytesProducts(NEWBYTES_URL, dolar),
    ];
    if (hasInvid) sources.push(fetchInvidProducts(INVID_USER, INVID_PASS, dolar));

    const results = await Promise.allSettled(sources);
    const elitProducts = results[0].status === 'fulfilled' ? results[0].value : [];
    const nbProducts = results[1].status === 'fulfilled' ? results[1].value : [];
    const invidProducts = hasInvid && results[2]?.status === 'fulfilled' ? results[2].value : [];

    const elitError = results[0].status === 'rejected' ? results[0].reason?.message : null;
    const nbError = results[1].status === 'rejected' ? results[1].reason?.message : null;
    const invidError = hasInvid && results[2]?.status === 'rejected' ? results[2].reason?.message : null;

    if (!elitProducts.length && !nbProducts.length && !invidProducts.length) {
      throw new Error(`Ninguna fuente pudo descargarse. Elit: ${elitError} | NB: ${nbError} | Invid: ${invidError}`);
    }

    logWithTrace(context, 'info', traceId, 'sync_parsed', {
      dolar,
      elit: elitProducts.length,
      newbytes: nbProducts.length,
      invid: invidProducts.length,
    });

    const pool = await connectDB();

    const mergeSource = async (products) => {
      let merged = { inserted: 0, updated: 0, total: 0 };
      for (const ch of chunk(products, 2000)) {
        const r = await mergeProducts(pool, ch);
        merged = {
          inserted: merged.inserted + r.inserted,
          updated: merged.updated + r.updated,
          total: merged.total + r.total,
        };
      }
      return merged;
    };

    const elitMerged = await mergeSource(elitProducts);
    const nbMerged = await mergeSource(nbProducts);
    const invidMerged = await mergeSource(invidProducts);

    await syncNewCategories(pool, [...elitProducts, ...nbProducts, ...invidProducts]);

    const duration = Math.round((Date.now() - startTime) / 1000);
    const syncResult = {
      success: true,
      trace_id: traceId,
      dolar_oficial: dolar,
      elit: { ...elitMerged, parsed: elitProducts.length, error: elitError },
      newbytes: { ...nbMerged, parsed: nbProducts.length, error: nbError },
      invid: {
        ...invidMerged,
        parsed: invidProducts.length,
        error: invidError,
        skipped: !hasInvid ? 'sin_credenciales' : null,
      },
      total: elitMerged.total + nbMerged.total + invidMerged.total,
      duration_sec: duration,
      timestamp: new Date().toISOString(),
    };

    await pool.request()
      .input('value', JSON.stringify(syncResult))
      .query(`
        UPDATE dbo.tovaltech_settings
        SET value = @value, updated_at = GETDATE()
        WHERE key_name = 'last_sync_result'
      `);

    logWithTrace(context, 'info', traceId, 'sync_complete', {
      total: syncResult.total,
      duration_sec: duration,
    });
    sendJson(context, {
      status: 200,
      traceId,
      body: syncResult,
    });
  } catch (err) {
    logWithTrace(context, 'error', traceId, 'sync_error', { error: err.message });

    try {
      const pool = await connectDB();
      await pool.request()
        .input('value', JSON.stringify({
          success: false,
          trace_id: traceId,
          error: err.message,
          timestamp: new Date().toISOString(),
        }))
        .query(`
          UPDATE dbo.tovaltech_settings
          SET value = @value, updated_at = GETDATE()
          WHERE key_name = 'last_sync_result'
        `);
    } catch {
      // Best-effort only.
    }

    sendJson(context, {
      status: 500,
      traceId,
      body: {
        success: false,
        error: err.message,
        trace_id: traceId,
      },
    });
  }
};
