// api/functions/fx.js
'use strict';

/**
 * TovalTech 2.0 — FX endpoints
 *
 * GET  /api/fx/current    → tipo de cambio actual (cache 5 min)
 * POST /api/fx/refresh    → forzar actualización [OPS/ADMIN]
 */

const { app } = require('@azure/functions');
const { getCurrentFxRate, refreshFxRate } = require('../shared/fx');
const { requireAuth, isAuthError }        = require('../shared/auth');
const { ok, serverError, fromAuthError, resolveCorrelationId } = require('../shared/response');

app.http('fxCurrent', {
  methods:   ['GET'],
  authLevel: 'anonymous',
  route:     'fx/current',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };

    try {
      const fx = await getCurrentFxRate();

      if (!fx) {
        return {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': resolveCorrelationId(req) },
          body: JSON.stringify({ error: 'FX_UNAVAILABLE', message: 'Tipo de cambio temporalmente no disponible' }),
        };
      }

      return ok({
        rate:        fx.rate,
        retrievedAt: fx.retrievedAt,
        source:      fx.source,
        fromCache:   fx.fromCache ?? false,
        // Display label para la UI: "1 USD = ARS 1.234,56 (Oficial venta) — 17/02/26 09:00"
        displayLabel: `1 USD = ARS ${fx.rate.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Oficial venta)`,
      }, req);
    } catch (err) {
      context.log(JSON.stringify({ level: 'error', message: 'fxCurrent error', error: err.message }));
      return serverError(err, req);
    }
  },
});

app.http('fxRefreshManual', {
  methods:   ['POST'],
  authLevel: 'anonymous',
  route:     'fx/refresh',
  handler:   async (request, context) => {
    const req = { headers: Object.fromEntries(request.headers) };

    try {
      const authResult = await requireAuth(req, ['OPS', 'ADMIN']);
      if (isAuthError(authResult)) return fromAuthError(authResult, req);

      const fx = await refreshFxRate();
      context.log(JSON.stringify({ level: 'info', message: 'fx: manual refresh triggered', rate: fx.rate, actor: authResult.caller.sub }));

      return ok({
        rate:        fx.rate,
        retrievedAt: fx.retrievedAt,
        source:      fx.source,
        refreshedBy: authResult.caller.email,
      }, req);
    } catch (err) {
      context.log(JSON.stringify({ level: 'error', message: 'fxRefresh error', error: err.message }));
      return serverError(err, req);
    }
  },
});
