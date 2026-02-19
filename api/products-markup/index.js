const connectDB = require('../db');

module.exports = async function (context, req) {
  try {
    const pool  = await connectDB();
    const id    = parseInt(context.bindingData.id, 10);
    const body  = req.body || {};

    if (!Number.isFinite(id)) {
      context.res = { status: 400, body: { error: 'ID inválido' } };
      return;
    }

    // markup_pct: number | null  (null = usar global)
    const markup = body.markup_pct === null || body.markup_pct === ''
      ? null
      : parseFloat(body.markup_pct);

    if (markup !== null && !Number.isFinite(markup)) {
      context.res = { status: 400, body: { error: 'markup_pct debe ser número o null' } };
      return;
    }

    await pool.request()
      .input('id', id)
      .input('markup', markup)
      .query(`
        UPDATE dbo.tovaltech_products
        SET markup_pct = @markup, updated_at = GETDATE()
        WHERE id = @id
      `);

    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { success: true, id, markup_pct: markup },
    };

  } catch (err) {
    context.res = {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: { error: err.message },
    };
  }
};
