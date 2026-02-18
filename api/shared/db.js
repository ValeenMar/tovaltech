// api/shared/db.js
'use strict';

const sql = require('mssql');

// ─── Config ──────────────────────────────────────────────────────────────────
const DB_SERVER   = process.env.DB_SERVER;
const DB_NAME     = process.env.DB_NAME;
const DB_USER     = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_PORT     = parseInt(process.env.DB_PORT || '1433', 10);

const POOL_CONFIG = {
  server:   DB_SERVER,
  database: DB_NAME,
  user:     DB_USER,
  password: DB_PASSWORD,
  port:     DB_PORT,
  options: {
    encrypt:                 true,   // Azure SQL requires TLS
    trustServerCertificate:  false,
    enableArithAbort:        true,
    connectTimeout:          30000,
    requestTimeout:          30000,
  },
  pool: {
    min:               0,
    max:               10,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 15000,
  },
};

// ─── Singleton pool ───────────────────────────────────────────────────────────
let _pool      = null;
let _connecting = false;
let _waitQueue  = [];

/**
 * Connects with exponential back-off.
 * @param {number} attempt  1-based retry counter
 */
async function _connect(attempt = 1) {
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 500;

  try {
    console.log(JSON.stringify({
      level: 'info',
      message: 'db: connecting to Azure SQL',
      attempt,
      server: DB_SERVER,
      database: DB_NAME,
    }));

    const pool = new sql.ConnectionPool(POOL_CONFIG);

    pool.on('error', (err) => {
      console.error(JSON.stringify({
        level: 'error',
        message: 'db: pool error — will reconnect on next call',
        error: err.message,
      }));
      _pool = null;
    });

    await pool.connect();

    console.log(JSON.stringify({
      level: 'info',
      message: 'db: pool connected',
      server: DB_SERVER,
      database: DB_NAME,
    }));

    return pool;
  } catch (err) {
    if (attempt >= MAX_RETRIES) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'db: max retries reached — giving up',
        attempt,
        error: err.message,
      }));
      throw err;
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);   // 500 → 1000 → 2000 → 4000 → 8000 ms
    console.warn(JSON.stringify({
      level: 'warn',
      message: 'db: connection failed — retrying',
      attempt,
      nextRetryMs: delay,
      error: err.message,
    }));

    await _sleep(delay);
    return _connect(attempt + 1);
  }
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns the shared connection pool.
 * Handles concurrent calls while connecting (queues them).
 */
async function getPool() {
  // Fast-path: pool already ready
  if (_pool && _pool.connected) return _pool;

  // If another call is already connecting, wait for it
  if (_connecting) {
    return new Promise((resolve, reject) => {
      _waitQueue.push({ resolve, reject });
    });
  }

  // We are the one responsible for connecting
  _connecting = true;

  try {
    _pool = await _connect();
    _connecting = false;

    // Resolve all queued callers
    for (const waiter of _waitQueue) waiter.resolve(_pool);
    _waitQueue = [];

    return _pool;
  } catch (err) {
    _connecting = false;
    _pool = null;

    for (const waiter of _waitQueue) waiter.reject(err);
    _waitQueue = [];

    throw err;
  }
}

/**
 * Convenience helper — returns a new Request bound to the shared pool.
 */
async function getRequest() {
  const pool = await getPool();
  return pool.request();
}

/**
 * Execute a stored procedure by name with named parameters.
 *
 * @param {string} spName             Stored procedure name
 * @param {Array<{name,type,value}>}  params  Array of parameter objects
 * @returns {sql.IResult<any>}
 *
 * @example
 * const result = await execSP('sp_CreateOrder', [
 *   { name: 'customer_id', type: sql.Int, value: 42 },
 * ]);
 */
async function execSP(spName, params = []) {
  const req = await getRequest();
  for (const p of params) {
    req.input(p.name, p.type, p.value);
  }
  return req.execute(spName);
}

/**
 * Execute raw parameterised SQL.
 *
 * @param {string} query     SQL string with @paramName placeholders
 * @param {Array<{name,type,value}>} params
 * @returns {sql.IResult<any>}
 */
async function execQuery(query, params = []) {
  const req = await getRequest();
  for (const p of params) {
    req.input(p.name, p.type, p.value);
  }
  return req.query(query);
}

module.exports = {
  getPool,
  getRequest,
  execSP,
  execQuery,
  sql,   // re-export for callers that need sql.Int, sql.NVarChar, etc.
};
