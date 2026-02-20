// api/banners/index.js
// GET  /api/banners          → lista banners (store: solo activos; admin: todos)
// POST /api/banners          → { action: 'create'|'update'|'delete'|'reorder' }

const connectDB = require('../db');
const headers = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const isAdmin = req.query.admin === '1';
      const where   = isAdmin ? '' : 'WHERE active = 1';
      const result  = await pool.request().query(`
        SELECT id, image_url, title, subtitle, link_url, sort_order, active, created_at, updated_at
        FROM dbo.tovaltech_banners
        ${where}
        ORDER BY sort_order ASC, id ASC
      `);

      // También traer el youtube_url de settings
      let youtubeUrl = '';
      try {
        const ytRes = await pool.request().query(`
          SELECT value FROM dbo.tovaltech_settings WHERE key_name = 'home_youtube_url'
        `);
        youtubeUrl = ytRes.recordset?.[0]?.value ?? '';
      } catch { /* la row puede no existir */ }

      context.res = {
        status: 200, headers,
        body: { banners: result.recordset || [], youtube_url: youtubeUrl },
      };
      return;
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body   = req.body || {};
      const action = body.action;

      // ── Guardar YouTube URL ────────────────────────────────────────────────
      if (action === 'set_youtube') {
        const url = String(body.youtube_url ?? '').trim();
        // Upsert en settings
        const exists = await pool.request().query(
          `SELECT key_name FROM dbo.tovaltech_settings WHERE key_name = 'home_youtube_url'`
        );
        if (exists.recordset.length) {
          await pool.request()
            .input('v', url)
            .query(`UPDATE dbo.tovaltech_settings SET value=@v, updated_at=GETDATE() WHERE key_name='home_youtube_url'`);
        } else {
          await pool.request()
            .input('v', url)
            .query(`INSERT INTO dbo.tovaltech_settings(key_name,value,description) VALUES('home_youtube_url',@v,'URL YouTube para el inicio')`);
        }
        context.res = { status: 200, headers, body: { success: true } };
        return;
      }

      // ── Crear banner ───────────────────────────────────────────────────────
      if (action === 'create') {
        const { image_url, title, subtitle, link_url, sort_order = 0 } = body;
        if (!image_url) {
          context.res = { status: 400, headers, body: { error: 'image_url requerido.' } };
          return;
        }
        const r = await pool.request()
          .input('image_url',  image_url.trim())
          .input('title',      title      || null)
          .input('subtitle',   subtitle   || null)
          .input('link_url',   link_url   || null)
          .input('sort_order', parseInt(sort_order, 10) || 0)
          .query(`
            INSERT INTO dbo.tovaltech_banners (image_url, title, subtitle, link_url, sort_order)
            OUTPUT INSERTED.*
            VALUES (@image_url, @title, @subtitle, @link_url, @sort_order)
          `);
        context.res = { status: 201, headers, body: { success: true, banner: r.recordset[0] } };
        return;
      }

      // ── Actualizar banner ──────────────────────────────────────────────────
      if (action === 'update') {
        const { id, image_url, title, subtitle, link_url, sort_order, active } = body;
        if (!id) {
          context.res = { status: 400, headers, body: { error: 'id requerido.' } };
          return;
        }
        const sets = [];
        const q    = pool.request().input('id', parseInt(id, 10));
        if (image_url  !== undefined) { q.input('image_url',  image_url);            sets.push('image_url = @image_url'); }
        if (title      !== undefined) { q.input('title',      title || null);        sets.push('title = @title'); }
        if (subtitle   !== undefined) { q.input('subtitle',   subtitle || null);     sets.push('subtitle = @subtitle'); }
        if (link_url   !== undefined) { q.input('link_url',   link_url || null);     sets.push('link_url = @link_url'); }
        if (sort_order !== undefined) { q.input('sort_order', parseInt(sort_order, 10) || 0); sets.push('sort_order = @sort_order'); }
        if (active     !== undefined) { q.input('active',     active ? 1 : 0);       sets.push('active = @active'); }

        if (!sets.length) {
          context.res = { status: 400, headers, body: { error: 'Nada para actualizar.' } };
          return;
        }
        sets.push('updated_at = GETDATE()');
        await q.query(`UPDATE dbo.tovaltech_banners SET ${sets.join(', ')} WHERE id = @id`);
        context.res = { status: 200, headers, body: { success: true } };
        return;
      }

      // ── Eliminar banner ────────────────────────────────────────────────────
      if (action === 'delete') {
        const numId = parseInt(body.id, 10);
        if (!Number.isFinite(numId)) {
          context.res = { status: 400, headers, body: { error: 'id inválido.' } };
          return;
        }
        await pool.request().input('id', numId)
          .query(`DELETE FROM dbo.tovaltech_banners WHERE id = @id`);
        context.res = { status: 200, headers, body: { success: true } };
        return;
      }

      context.res = { status: 400, headers, body: { error: `Acción desconocida: "${action}"` } };
      return;
    }

    context.res = { status: 405, headers, body: { error: 'Method not allowed' } };

  } catch (err) {
    context.log.error('banners_error', err.message);
    context.res = { status: 500, headers, body: { error: 'banners_failed', message: err.message } };
  }
};
