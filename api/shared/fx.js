// api/shared/fx.js
'use strict';

const fetch             = require('node-fetch');
const { execQuery, sql } = require('./db');

const DOLAR_API_URL    = 'https://dolarapi.com/v1/dolares/oficial';
const CACHE_TTL_MS     = 5 * 60 * 1000;   // 5 minutes
const SOURCE_LABEL     = 'dolarapi_oficial_venta';

// ─── In-memory cache ──────────────────────────────────────────────────────────
let _cache = {
  rate:        null,      // number
  retrievedAt: null,      // ISO string (UTC)
  cachedAt:    0,         // Date.now() timestamp
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Fetches the current USD→ARS official "venta" rate from DolarAPI.
 * Returns { rate: number, retrievedAt: string (ISO UTC) }
 */
async function _fetchFromApi() {
  const res = await fetch(DOLAR_API_URL, {
    headers: { 'User-Agent': 'TovalTech/2.0 fx-refresh' },
    timeout: 10000,
  });

  if (!res.ok) {
    throw new Error(`DolarAPI returned HTTP ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // DolarAPI response shape: { moneda, casa, nombre, compra, venta, fechaActualizacion }
  if (typeof data.venta !== 'number' || data.venta <= 0) {
    throw new Error(`DolarAPI unexpected payload: ${JSON.stringify(data)}`);
  }

  return {
    rate:        data.venta,
    retrievedAt: data.fechaActualizacion
      ? new Date(data.fechaActualizacion).toISOString()
      : new Date().toISOString(),
  };
}

/**
 * Persists a new FX rate to the database:
 * 1. Sets is_current = 0 on all existing rows.
 * 2. Inserts the new row with is_current = 1.
 */
async function _persistRate(rate, retrievedAt) {
  // Unmark all current
  await execQuery(
    `UPDATE fx_rates SET is_current = 0 WHERE is_current = 1`,
    []
  );

  // Insert new current row
  await execQuery(
    `INSERT INTO fx_rates (rate_ars_per_usd, source, retrieved_at, is_current)
     VALUES (@rate, @source, @retrieved_at, 1)`,
    [
      { name: 'rate',         type: sql.Decimal(14, 4), value: rate },
      { name: 'source',       type: sql.NVarChar(100),  value: SOURCE_LABEL },
      { name: 'retrieved_at', type: sql.DateTime2,      value: new Date(retrievedAt) },
    ]
  );

  console.log(JSON.stringify({
    level: 'info',
    message: 'fx: rate persisted to DB',
    rate,
    retrievedAt,
    source: SOURCE_LABEL,
  }));
}

/**
 * Loads the current FX rate from DB (fallback when API is unreachable).
 * Returns { rate, retrievedAt } or null if no row exists.
 */
async function _loadFromDb() {
  const result = await execQuery(
    `SELECT TOP 1 rate_ars_per_usd, retrieved_at
     FROM fx_rates
     WHERE is_current = 1
     ORDER BY retrieved_at DESC`,
    []
  );

  const row = result.recordset[0];
  if (!row) return null;

  return {
    rate:        parseFloat(row.rate_ars_per_usd),
    retrievedAt: row.retrieved_at instanceof Date
      ? row.retrieved_at.toISOString()
      : String(row.retrieved_at),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Refreshes the FX rate from DolarAPI, persists it to DB, updates cache.
 * Called by the timer trigger AND can be called manually.
 *
 * @returns {{ rate: number, retrievedAt: string, source: string }}
 */
async function refreshFxRate() {
  try {
    const { rate, retrievedAt } = await _fetchFromApi();
    await _persistRate(rate, retrievedAt);

    _cache = { rate, retrievedAt, cachedAt: Date.now() };

    return { rate, retrievedAt, source: SOURCE_LABEL };
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'fx: failed to fetch from DolarAPI',
      error: err.message,
    }));
    throw err;
  }
}

/**
 * Returns the current FX rate.
 * Uses in-memory cache if fresh (< 5 min); otherwise fetches from DB then API.
 *
 * @returns {{ rate: number, retrievedAt: string, source: string } | null}
 */
async function getCurrentFxRate() {
  // Serve from cache if still fresh
  if (_cache.rate && Date.now() - _cache.cachedAt < CACHE_TTL_MS) {
    return {
      rate:        _cache.rate,
      retrievedAt: _cache.retrievedAt,
      source:      SOURCE_LABEL,
      fromCache:   true,
    };
  }

  // Try DB first (fast, always available)
  try {
    const dbRow = await _loadFromDb();
    if (dbRow) {
      _cache = { rate: dbRow.rate, retrievedAt: dbRow.retrievedAt, cachedAt: Date.now() };
      return { rate: dbRow.rate, retrievedAt: dbRow.retrievedAt, source: SOURCE_LABEL, fromCache: false };
    }
  } catch (dbErr) {
    console.warn(JSON.stringify({
      level: 'warn',
      message: 'fx: DB read failed, falling back to API',
      error: dbErr.message,
    }));
  }

  // Last resort: call DolarAPI directly
  return refreshFxRate();
}

/**
 * Same as getCurrentFxRate() but throws if no rate is available.
 * Use this when a valid FX rate is strictly required (e.g. order creation).
 *
 * @returns {{ rate: number, retrievedAt: string, source: string }}
 * @throws {Error} if no rate can be obtained
 */
async function getFxRateOrThrow() {
  const fx = await getCurrentFxRate();

  if (!fx || typeof fx.rate !== 'number' || fx.rate <= 0) {
    throw new Error('FX rate unavailable — cannot proceed without a valid ARS/USD rate');
  }

  return fx;
}

module.exports = {
  refreshFxRate,
  getCurrentFxRate,
  getFxRateOrThrow,
};
