// api/products-markup/index.js
// Ruta: POST /api/products/{id}/markup
// Maneja markup individual, toggle de visibilidad, nombre y descripcion
// Body: { markup_pct, active, featured, name, description } — cualquiera o todos

const connectDB = require('../db');
const { requireAdmin } = require('../_shared/require-admin');
const headers = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  try {
    const { isAdmin } = requireAdmin(req);
    if (!isAdmin) {
      context.res = { status: 403, headers, body: { error: 'forbidden' } };
      return;
    }

    const pool = await connectDB();
    const id   = parseInt(context.bindingData.id, 10);
    const body = req.body || {};

    if (!Number.isFinite(id)) {
      context.res = { status: 400, headers, body: { error: 'ID invalido' } };
      return;
    }
    const sets = [];
    const q    = pool.request().input('id', id);

    // Markup
    if ('markup_pct' in body) {
      const markup = body.markup_pct === null || body.markup_pct === ''
        ? null : parseFloat(body.markup_pct);
      if (markup !== null && !Number.isFinite(markup)) {
        context.res = { status: 400, headers, body: { error: 'markup_pct invalido' } };
        return;
      }
      q.input('markup', markup);
      sets.push('markup_pct = @markup');
    }

    // Visibilidad
    if ('active' in body) {
      q.input('active', body.active ? 1 : 0);
      sets.push('active = @active');
    }

    // Destacado
    if ('featured' in body) {
      q.input('featured', body.featured ? 1 : 0);
      sets.push('featured = @featured');
    }

    // Nombre
    if ('name' in body) {
      const name = String(body.name || '').trim();
      if (!name) {
        context.res = { status: 400, headers, body: { error: 'El nombre no puede estar vacio' } };
        return;
      }
      q.input('name', name);
      sets.push('name = @name');
    }

    // Descripcion
    if ('description' in body) {
      const desc = body.description === null ? null : String(body.description).trim();
      q.input('description', desc);
      sets.push('description = @description');
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
