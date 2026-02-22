// api/banners/index.js
// GET  /api/banners          → lista banners (store: solo activos; admin: todos)
// POST /api/banners          → { action: 'create'|'update'|'delete'|'set_youtube'|'set_dimensions' }

const connectDB = require('../db');
const { requireAdminIfRequested, requireAdmin } = require('../_shared/require-admin');
const headers = { 'content-type': 'application/json' };

// ── Cache en memoria para el GET público de la tienda ─────────────────────────
// Evita ir a SQL en cada carga del hero. TTL: 2 minutos.
// El admin puede forzar refresco pasando ?admin=1.
// Cualquier POST (create/update/delete/set_*) invalida el cache inmediatamente.
let _bannersCache     = null;
let _bannersCacheTime = 0;
const BANNERS_TTL = 2 * 60 * 1000; // 2 minutos en ms

function setCache(data) {
  _bannersCache     = data;
  _bannersCacheTime = Date.now();
}

function invalidateCache() {
  _bannersCache = null;
}

function getCache() {
  if (!_bannersCache) return null;
  if (Date.now() - _bannersCacheTime > BANNERS_TTL) {
    _bannersCache = null;
    return null;
  }
  return _bannersCache;
}

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const adminMode = requireAdminIfRequested(req);
      if (adminMode.forbidden) {
        context.res = { status: 403, headers, body: { error: 'forbidden' } };
        return;
      }
      const isAdmin = adminMode.isAdmin;

      // Servir desde cache si es una petición de la tienda y el cache es válido
      if (!isAdmin) {
        const cached = getCache();
        if (cached) {
          context.res = { status: 200, headers, body: cached };
          return;
        }
      }

      const where   = isAdmin ? '' : 'WHERE active = 1';
      const result  = await pool.request().query(`
        SELECT id, image_url, title, subtitle, link_url, sort_order, active, created_at, updated_at
        FROM dbo.tovaltech_banners
        ${where}
        ORDER BY sort_order ASC, id ASC
      `);

      // Traer configuración de settings (youtube + dimensiones)
      let youtubeUrl = '';
      let bannerWidth  = 1440;
      let bannerHeight = 500;
      try {
        const settingsRes = await pool.request().query(`
          SELECT key_name, value FROM dbo.tovaltech_settings
          WHERE key_name IN ('home_youtube_url', 'banner_width', 'banner_height')
        `);
        for (const row of settingsRes.recordset || []) {
          if (row.key_name === 'home_youtube_url') youtubeUrl   = row.value ?? '';
          if (row.key_name === 'banner_width')     bannerWidth  = parseInt(row.value, 10) || 1440;
          if (row.key_name === 'banner_height')    bannerHeight = parseInt(row.value, 10) || 500;
        }
      } catch { /* rows pueden no existir */ }

      const responseBody = {
        banners: result.recordset || [],
        youtube_url: youtubeUrl,
        banner_width:  bannerWidth,
        banner_height: bannerHeight,
      };

      // Guardar en cache solo para tienda
      if (!isAdmin) setCache(responseBody);

      context.res = { status: 200, headers, body: responseBody };
      return;
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin.isAdmin) {
        context.res = { status: 403, headers, body: { error: 'forbidden' } };
        return;
      }

      const body   = req.body || {};
      const action = body.action;
      // Cualquier escritura invalida el cache
      invalidateCache();

      // ── Guardar YouTube URL ────────────────────────────────────────────────
      if (action === 'set_youtube') {
        const url = String(body.youtube_url ?? '').trim();
        await upsertSetting(pool, 'home_youtube_url', url, 'URL YouTube para el inicio');
        context.res = { status: 200, headers, body: { success: true } };
        return;
      }

      // ── Guardar dimensiones del hero ───────────────────────────────────────
      if (action === 'set_dimensions') {
        const w = parseInt(body.banner_width,  10);
        const h = parseInt(body.banner_height, 10);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w < 100 || h < 50) {
          context.res = { status: 400, headers, body: { error: 'Dimensiones inválidas.' } };
          return;
        }
        await upsertSetting(pool, 'banner_width',  String(w), 'Ancho del hero en px');
        await upsertSetting(pool, 'banner_height', String(h), 'Alto del hero en px');
        context.res = { status: 200, headers, body: { success: true, banner_width: w, banner_height: h } };
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

// ── Helper: upsert en tovaltech_settings ─────────────────────────────────────
async function upsertSetting(pool, keyName, value, description) {
  const exists = await pool.request()
    .input('k', keyName)
    .query(`SELECT key_name FROM dbo.tovaltech_settings WHERE key_name = @k`);
  if (exists.recordset.length) {
    await pool.request()
      .input('k', keyName)
      .input('v', value)
      .query(`UPDATE dbo.tovaltech_settings SET value=@v, updated_at=GETDATE() WHERE key_name=@k`);
  } else {
    await pool.request()
      .input('k', keyName)
      .input('v', value)
      .input('d', description || '')
      .query(`INSERT INTO dbo.tovaltech_settings(key_name,value,description) VALUES(@k,@v,@d)`);
  }
}
