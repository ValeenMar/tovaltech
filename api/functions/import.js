// api/functions/import.js
'use strict';

/**
 * TovalTech 2.0 — Import endpoints
 *
 * POST /api/import/elit          → sync CSV desde URL de Elit [OPS/ADMIN]
 * POST /api/import/nb            → sync XLSX desde URL de NB  [OPS/ADMIN]
 * POST /api/import/nb/upload     → subir XLSX de NB manualmente [OPS/ADMIN]
 *
 * Todos requieren rol OPS o ADMIN. Retornan el log de importación.
 * Los logs también se persisten en la tabla import_logs.
 */

const { app }  = require('@azure/functions');
const db       = require('../shared/db');
const { getCurrentFxRate }                = require('../shared/fx');
const { requireAuth, isAuthError }        = require('../shared/auth');
const { ok, badRequest, serverError, fromAuthError, resolveCorrelationId } = require('../shared/response');
const { fetchElitProducts, upsertElitProducts } = require('../shared/importers/elit');
const { fetchNbProducts, upsertNbProducts, _parseXlsx } = require('../shared/importers/nb');

// ─── POST /api/import/elit ────────────────────────────────────────────────────
app.http('importElit', {
  methods:   ['POST'],
  authLevel: 'anonymous',
  route:     'import/elit',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };
    const correlationId = resolveCorrelationId(req);
    const startedAt = new Date();

    try {
      const authResult = await requireAuth(req, ['OPS', 'ADMIN']);
      if (isAuthError(authResult)) return fromAuthError(authResult, req);

      context.log(JSON.stringify({
        level: 'info', message: 'import/elit: started',
        actor: authResult.caller.email, correlationId,
      }));

      // Resolver provider_id de Elit desde env var
      const providerId = parseInt(process.env.ELIT_PROVIDER_ID || '0', 10);
      if (!providerId) return badRequest('ELIT_PROVIDER_ID no configurado', req);

      const importSourceId = await _resolveImportSourceId(providerId, 'elit_csv');

      // Registrar inicio en import_logs
      const logId = await _startImportLog(importSourceId);

      let result;
      try {
        const products = await fetchElitProducts();
        context.log(JSON.stringify({ level: 'info', message: 'import/elit: fetched', count: products.length }));

        result = await upsertElitProducts(db, providerId, products);
      } catch (importErr) {
        await _finishImportLog(logId, 'FAILED', 0, 0, 0, 0, [{ error: importErr.message }], startedAt);
        return serverError(importErr, req);
      }

      const durationMs = Date.now() - startedAt.getTime();
      const status     = result.failed === 0 ? 'SUCCESS' : result.inserted + result.updated > 0 ? 'PARTIAL' : 'FAILED';

      await _finishImportLog(
        logId, status,
        result.inserted + result.updated + result.failed,
        result.inserted, result.updated, result.failed,
        result.errors, startedAt
      );

      await _updateLastSynced(importSourceId);

      context.log(JSON.stringify({
        level: 'info', message: 'import/elit: finished',
        ...result, durationMs, correlationId,
      }));

      return ok({ source: 'elit', status, ...result, durationMs }, req);
    } catch (err) {
      context.log(JSON.stringify({ level: 'error', message: 'import/elit error', error: err.message, correlationId }));
      return serverError(err, req);
    }
  },
});

// ─── POST /api/import/nb ──────────────────────────────────────────────────────
app.http('importNb', {
  methods:   ['POST'],
  authLevel: 'anonymous',
  route:     'import/nb',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };
    const correlationId = resolveCorrelationId(req);
    const startedAt = new Date();

    try {
      const authResult = await requireAuth(req, ['OPS', 'ADMIN']);
      if (isAuthError(authResult)) return fromAuthError(authResult, req);

      const providerId = parseInt(process.env.NB_PROVIDER_ID || '0', 10);
      if (!providerId) return badRequest('NB_PROVIDER_ID no configurado', req);

      const importSourceId = await _resolveImportSourceId(providerId, 'nb_xlsx');
      const logId = await _startImportLog(importSourceId);

      let result;
      try {
        // Si NB usa precios ARS necesitamos el FX actual
        let fxRate = null;
        if ((process.env.NB_PRICE_CURRENCY || 'USD').toUpperCase() === 'ARS') {
          const fx = await getCurrentFxRate();
          fxRate = fx?.rate ?? null;
        }

        const products = await fetchNbProducts();
        context.log(JSON.stringify({ level: 'info', message: 'import/nb: fetched', count: products.length }));

        result = await upsertNbProducts(db, providerId, products, fxRate);
      } catch (importErr) {
        await _finishImportLog(logId, 'FAILED', 0, 0, 0, 0, [{ error: importErr.message }], startedAt);
        return serverError(importErr, req);
      }

      const durationMs = Date.now() - startedAt.getTime();
      const status     = result.failed === 0 ? 'SUCCESS' : result.inserted + result.updated > 0 ? 'PARTIAL' : 'FAILED';

      await _finishImportLog(logId, status,
        result.inserted + result.updated + result.failed,
        result.inserted, result.updated, result.failed, result.errors, startedAt
      );
      await _updateLastSynced(importSourceId);

      return ok({ source: 'nb', status, ...result, durationMs }, req);
    } catch (err) {
      context.log(JSON.stringify({ level: 'error', message: 'import/nb error', error: err.message, correlationId }));
      return serverError(err, req);
    }
  },
});

// ─── POST /api/import/nb/upload ───────────────────────────────────────────────
// Permite subir un XLSX de NB directamente (sin URL)
app.http('importNbUpload', {
  methods:   ['POST'],
  authLevel: 'anonymous',
  route:     'import/nb/upload',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };
    const correlationId = resolveCorrelationId(req);
    const startedAt = new Date();

    try {
      const authResult = await requireAuth(req, ['OPS', 'ADMIN']);
      if (isAuthError(authResult)) return fromAuthError(authResult, req);

      const providerId = parseInt(process.env.NB_PROVIDER_ID || '0', 10);
      if (!providerId) return badRequest('NB_PROVIDER_ID no configurado', req);

      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('application/octet-stream') && !contentType.includes('multipart/form-data')) {
        return badRequest('Content-Type debe ser application/octet-stream o multipart/form-data', req);
      }

      // Leer el body como buffer binario
      const arrayBuffer = await request.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) return badRequest('Body vacío', req);

      const buffer = Buffer.from(arrayBuffer);

      let products;
      try {
        products = _parseXlsx(buffer);
      } catch (parseErr) {
        return badRequest(`Error parseando XLSX: ${parseErr.message}`, req);
      }

      context.log(JSON.stringify({ level: 'info', message: 'import/nb/upload: parsed', count: products.length, correlationId }));

      let fxRate = null;
      if ((process.env.NB_PRICE_CURRENCY || 'USD').toUpperCase() === 'ARS') {
        const fx = await getCurrentFxRate();
        fxRate = fx?.rate ?? null;
      }

      const importSourceId = await _resolveImportSourceId(providerId, 'nb_xlsx');
      const logId          = await _startImportLog(importSourceId);
      const result         = await upsertNbProducts(db, providerId, products, fxRate);
      const durationMs     = Date.now() - startedAt.getTime();
      const status         = result.failed === 0 ? 'SUCCESS' : result.inserted + result.updated > 0 ? 'PARTIAL' : 'FAILED';

      await _finishImportLog(logId, status,
        result.inserted + result.updated + result.failed,
        result.inserted, result.updated, result.failed, result.errors, startedAt
      );

      return ok({ source: 'nb_upload', status, ...result, durationMs }, req);
    } catch (err) {
      context.log(JSON.stringify({ level: 'error', message: 'import/nb/upload error', error: err.message, correlationId }));
      return serverError(err, req);
    }
  },
});

// ─── GET /api/import/logs ─────────────────────────────────────────────────────
app.http('importLogs', {
  methods:   ['GET'],
  authLevel: 'anonymous',
  route:     'import/logs',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };
    try {
      const authResult = await requireAuth(req, ['OPS', 'ADMIN']);
      if (isAuthError(authResult)) return fromAuthError(authResult, req);

      const result = await db.execQuery(
        `SELECT TOP 50
           il.id, il.status, il.rows_total, il.rows_inserted, il.rows_updated,
           il.rows_failed, il.duration_ms, il.started_at, il.finished_at,
           imp.name AS source_name, pv.name AS provider_name
         FROM import_logs il
         JOIN import_sources imp ON imp.id = il.import_source_id
         JOIN providers pv       ON pv.id  = imp.provider_id
         ORDER BY il.started_at DESC`,
        []
      );

      return ok(result.recordset, req);
    } catch (err) {
      return serverError(err, req);
    }
  },
});

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function _resolveImportSourceId(providerId, sourceType) {
  const res = await db.execQuery(
    `SELECT TOP 1 id FROM import_sources WHERE provider_id = @pid ORDER BY id ASC`,
    [{ name: 'pid', type: db.sql.Int, value: providerId }]
  );
  return res.recordset[0]?.id ?? null;
}

async function _startImportLog(importSourceId) {
  if (!importSourceId) return null;
  const res = await db.execQuery(
    `INSERT INTO import_logs (import_source_id, status, started_at)
     OUTPUT INSERTED.id
     VALUES (@src, 'RUNNING', GETUTCDATE())`,
    [{ name: 'src', type: db.sql.Int, value: importSourceId }]
  );
  return res.recordset[0]?.id ?? null;
}

async function _finishImportLog(logId, status, total, inserted, updated, failed, errors, startedAt) {
  if (!logId) return;
  const durationMs = Date.now() - startedAt.getTime();
  await db.execQuery(
    `UPDATE import_logs SET
       status       = @status,
       rows_total   = @total,
       rows_inserted= @inserted,
       rows_updated = @updated,
       rows_failed  = @failed,
       errors_json  = @errors,
       duration_ms  = @dur,
       finished_at  = GETUTCDATE()
     WHERE id = @id`,
    [
      { name: 'id',       type: db.sql.Int,            value: logId },
      { name: 'status',   type: db.sql.NVarChar(20),   value: status },
      { name: 'total',    type: db.sql.Int,            value: total },
      { name: 'inserted', type: db.sql.Int,            value: inserted },
      { name: 'updated',  type: db.sql.Int,            value: updated },
      { name: 'failed',   type: db.sql.Int,            value: failed },
      { name: 'errors',   type: db.sql.NVarChar('max'),value: errors.length ? JSON.stringify(errors.slice(0, 100)) : null },
      { name: 'dur',      type: db.sql.Int,            value: durationMs },
    ]
  );
}

async function _updateLastSynced(importSourceId) {
  if (!importSourceId) return;
  await db.execQuery(
    `UPDATE import_sources SET last_synced_at = GETUTCDATE() WHERE id = @id`,
    [{ name: 'id', type: db.sql.Int, value: importSourceId }]
  );
}
