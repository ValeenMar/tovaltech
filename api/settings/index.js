const connectDB = require('../db');

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    // GET — devuelve todas las settings
    if (req.method === 'GET') {
      const result = await pool.request().query(`
        SELECT key_name, value, description, updated_at
        FROM dbo.tovaltech_settings
        ORDER BY key_name
      `);

      const settings = {};
      for (const row of result.recordset) {
        settings[row.key_name] = {
          value: row.value,
          description: row.description,
          updated_at: row.updated_at,
        };
      }

      context.res = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: settings,
      };
      return;
    }

    // POST — actualiza una o más settings
    if (req.method === 'POST') {
      const body = req.body || {};

      if (!Object.keys(body).length) {
        context.res = { status: 400, body: { error: 'Body vacío' } };
        return;
      }

      for (const [key, value] of Object.entries(body)) {
        await pool.request()
          .input('key_name', key)
          .input('value', String(value))
          .query(`
            UPDATE dbo.tovaltech_settings
            SET value = @value, updated_at = GETDATE()
            WHERE key_name = @key_name
          `);
      }

      context.res = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { success: true, updated: Object.keys(body) },
      };
      return;
    }

    context.res = { status: 405, body: { error: 'Method not allowed' } };

  } catch (err) {
    context.log.error('settings_error', err);
    context.res = {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: { error: err.message },
    };
  }
};
