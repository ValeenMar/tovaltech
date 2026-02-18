// api/timers/fx-refresh/index.js
'use strict';

/**
 * TovalTech 2.0 — FX Rate Refresh Timer
 *
 * Runs every 10 minutes via Azure Functions Timer Trigger.
 * Fetches the ARS/USD "dólar oficial venta" from DolarAPI, persists it
 * in the fx_rates table (flipping is_current), and logs structured output
 * for Application Insights.
 *
 * Cron: "0 *\/10 * * * *"  — fires at 0 seconds of every 10th minute
 */

const { app } = require('@azure/functions');
const { refreshFxRate } = require('../../shared/fx');

app.timer('fxRefresh', {
  // Azure Functions v4 timer format: NCRONTAB (6 fields — includes seconds)
  schedule: '0 */10 * * * *',

  // Run immediately on startup if the last scheduled run was missed
  // (useful after deployments / cold starts)
  runOnStartup: process.env.NODE_ENV !== 'production',

  handler: async (myTimer, context) => {
    const startedAt = new Date().toISOString();
    const isPastDue  = myTimer.isPastDue;

    context.log(JSON.stringify({
      level:     'info',
      message:   'fx-refresh: timer fired',
      startedAt,
      isPastDue,
    }));

    if (isPastDue) {
      context.log(JSON.stringify({
        level:   'warn',
        message: 'fx-refresh: timer is running late — executing anyway',
      }));
    }

    try {
      const result = await refreshFxRate();

      const finishedAt  = new Date().toISOString();
      const durationMs  = Date.now() - new Date(startedAt).getTime();

      context.log(JSON.stringify({
        level:       'info',
        message:     'fx-refresh: rate updated successfully',
        rate:        result.rate,
        retrievedAt: result.retrievedAt,
        source:      result.source,
        finishedAt,
        durationMs,
      }));

      // Application Insights custom metric (picked up automatically by the host)
      context.log(JSON.stringify({
        level:   'info',
        message: 'fx-refresh: metric',
        metric: {
          name:  'FxRefreshSuccess',
          value: 1,
        },
        rateArsPerUsd: result.rate,
      }));
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - new Date(startedAt).getTime();

      context.log(JSON.stringify({
        level:      'error',
        message:    'fx-refresh: failed to refresh rate',
        error:      err.message,
        stack:      err.stack,
        finishedAt,
        durationMs,
      }));

      // Log metric for alerting
      context.log(JSON.stringify({
        level:   'error',
        message: 'fx-refresh: metric',
        metric: {
          name:  'FxRefreshFailure',
          value: 1,
        },
        errorMessage: err.message,
      }));

      // Re-throw so Azure Functions marks this execution as Failed
      // (enables built-in retry and monitoring alerts)
      throw err;
    }
  },
});
