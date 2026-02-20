// api/products-markup/index.js
// Ruta: POST /api/products/{id}/markup
// Maneja markup individual Y toggle de visibilidad (active)
// Body: { markup_pct: number|null, active: bool }  — cualquiera o ambos

const connectDB = require('../db');
const headers = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();
    const id   = parseInt(context.bindingData.id, 10);
    const body = req.body || {};

    if (!Number.isFinite(id)) {
      context.res = { status: 400, headers, body: { error: 'ID inválido' } };
      return;
    }
    const sets = [];
    const q    = pool.request().input('id', id);

    // ── Markup ──────────────────────────────────────────────────────────────
    if ('markup_pct' in body) {
      const markup = body.markup_pct === null || body.markup_pct === ''
        ? null : parseFloat(body.markup_pct);
      if (markup !== null && !Number.isFinite(markup)) {
        context.res = { status: 400, headers, body: { error: 'markup_pct inválido' } };
        return;
      }
      q.input('markup', markup);
      sets.push('markup_pct = @markup');
    }

    // ── Visibilidad (active) ────────────────────────────────────────────────
    if ('active' in body) {
      q.input('active', body.active ? 1 : 0);
      sets.push('active = @active');
    }

    if (!sets.length) {
      context.res = { status: 400, headers, body: { error: 'Nada para actualizar.' } };
      return;
    }

    sets.push('updated_at = GETDATE()');
    await q.query(`UPDATE dbo.tovaltech_products SET ${sets.join(', ')} WHERE id = @id`);

    context.res = { status: 200, headers, body: { success: true, id } };
  } catch (err) {
    context.res = { status: 500, headers, body: { error: err.message } };
  }
};
