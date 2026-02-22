const sql = require('mssql');

function toPositiveInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

class QuoteReservationError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'QuoteReservationError';
    this.code = code;
    this.details = details;
  }
}

async function safeRollback(transaction) {
  try {
    await transaction.rollback();
  } catch {
    // Ignore rollback errors: transaction may already be closed.
  }
}

function extractQuoteItems(payloadInput) {
  let payload = payloadInput;
  if (typeof payloadInput === 'string') {
    try {
      payload = JSON.parse(payloadInput);
    } catch {
      return [];
    }
  }

  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  const items = [];
  for (const raw of rawItems) {
    const id = toPositiveInt(raw?.id);
    const quantity = toPositiveInt(raw?.quantity);
    if (!id || !quantity) continue;
    items.push({ id, quantity });
  }
  return items;
}

async function reserveQuoteStockAndInsert(pool, { quoteId, payload, totalArs, expiresAt, fingerprint }) {
  const items = extractQuoteItems(payload);
  if (!items.length) {
    throw new QuoteReservationError('quote_items_missing');
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    for (const item of items) {
      const reserveReq = new sql.Request(transaction);
      reserveReq.input('id', sql.Int, item.id);
      reserveReq.input('qty', sql.Int, item.quantity);
      const reserveRes = await reserveReq.query(`
        UPDATE dbo.tovaltech_products
        SET stock = stock - @qty,
            updated_at = GETDATE()
        WHERE id = @id
          AND (active IS NULL OR active = 1)
          AND stock >= @qty
      `);

      if ((reserveRes.rowsAffected?.[0] || 0) === 1) continue;

      const checkRes = await new sql.Request(transaction)
        .input('id', sql.Int, item.id)
        .query(`
          SELECT id, stock, active
          FROM dbo.tovaltech_products
          WHERE id = @id
        `);

      if (!checkRes.recordset.length) {
        throw new QuoteReservationError('product_not_found', { product_id: item.id });
      }

      const row = checkRes.recordset[0];
      if (row.active === 0) {
        throw new QuoteReservationError('product_inactive', { product_id: item.id });
      }

      throw new QuoteReservationError('insufficient_stock', {
        product_id: item.id,
        available: row.stock ?? 0,
        requested: item.quantity,
      });
    }

    await new sql.Request(transaction)
      .input('quote_id', sql.NVarChar(64), quoteId)
      .input('payload_json', sql.NVarChar(sql.MAX), JSON.stringify(payload))
      .input('total_ars', sql.Int, totalArs)
      .input('expires_at', sql.DateTime2, expiresAt)
      .input('request_fingerprint', sql.NVarChar(128), fingerprint)
      .query(`
        INSERT INTO dbo.tovaltech_checkout_quotes
          (quote_id, payload_json, total_ars, expires_at, request_fingerprint, created_at)
        VALUES
          (@quote_id, @payload_json, @total_ars, @expires_at, @request_fingerprint, SYSUTCDATETIME())
      `);

    await transaction.commit();
    return { reserved_items: items.length };
  } catch (err) {
    await safeRollback(transaction);
    throw err;
  }
}

async function releaseQuoteStock(pool, quoteId, reason = 'manual', options = {}) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    const quoteRes = await new sql.Request(transaction)
      .input('quote_id', sql.NVarChar(64), quoteId)
      .query(`
        SELECT quote_id, payload_json, used_at, expires_at, released_at
        FROM dbo.tovaltech_checkout_quotes WITH (UPDLOCK, ROWLOCK)
        WHERE quote_id = @quote_id
      `);

    if (!quoteRes.recordset.length) {
      await transaction.rollback();
      return { released: false, reason: 'quote_not_found' };
    }

    const quote = quoteRes.recordset[0];
    if (quote.released_at) {
      await transaction.rollback();
      return { released: false, reason: 'already_released' };
    }
    if (options.requireUnused && quote.used_at) {
      await transaction.rollback();
      return { released: false, reason: 'already_used' };
    }
    if (options.requireExpired && new Date(quote.expires_at).getTime() >= Date.now()) {
      await transaction.rollback();
      return { released: false, reason: 'not_expired' };
    }

    const markReq = new sql.Request(transaction);
    markReq.input('quote_id', sql.NVarChar(64), quoteId);
    markReq.input('released_reason', sql.NVarChar(40), String(reason || 'manual').slice(0, 40));
    const markRes = await markReq.query(`
      UPDATE dbo.tovaltech_checkout_quotes
      SET released_at = SYSUTCDATETIME(),
          released_reason = @released_reason
      WHERE quote_id = @quote_id
        AND released_at IS NULL
        ${options.requireUnused ? 'AND used_at IS NULL' : ''}
        ${options.requireExpired ? 'AND expires_at < SYSUTCDATETIME()' : ''}
    `);

    if ((markRes.rowsAffected?.[0] || 0) === 0) {
      await transaction.rollback();
      return { released: false, reason: 'not_releasable' };
    }

    const items = extractQuoteItems(quote.payload_json);
    for (const item of items) {
      await new sql.Request(transaction)
        .input('id', sql.Int, item.id)
        .input('qty', sql.Int, item.quantity)
        .query(`
          UPDATE dbo.tovaltech_products
          SET stock = stock + @qty,
              updated_at = GETDATE()
          WHERE id = @id
        `);
    }

    await transaction.commit();
    return { released: true, items: items.length };
  } catch (err) {
    await safeRollback(transaction);
    throw err;
  }
}

async function releaseExpiredQuotes(pool, limit = 30) {
  const max = Math.max(1, Math.min(toPositiveInt(limit, 30), 300));
  const candidatesRes = await pool.request()
    .input('limit', sql.Int, max)
    .query(`
      SELECT TOP (@limit) quote_id
      FROM dbo.tovaltech_checkout_quotes
      WHERE released_at IS NULL
        AND used_at IS NULL
        AND expires_at < SYSUTCDATETIME()
      ORDER BY expires_at ASC
    `);

  let released = 0;
  let scanned = 0;
  for (const row of candidatesRes.recordset || []) {
    scanned += 1;
    const result = await releaseQuoteStock(pool, row.quote_id, 'expired', {
      requireUnused: true,
      requireExpired: true,
    });
    if (result.released) released += 1;
  }

  return { scanned, released };
}

module.exports = {
  QuoteReservationError,
  extractQuoteItems,
  reserveQuoteStockAndInsert,
  releaseQuoteStock,
  releaseExpiredQuotes,
};
