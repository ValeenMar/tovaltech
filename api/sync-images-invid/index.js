/**
 * api/sync-images-invid/index.js
 *
 * POST /api/sync-images-invid
 *
 * Busca imágenes para los productos de Invid que no tienen imagen todavía.
 * Construye la URL del producto a partir del nombre y el código (SKU),
 * hace scraping del og:image, y actualiza image_url + active=1 en la DB.
 *
 * Se corre desde el admin (botón en Settings). No bloquea el sync principal.
 *
 * Variables de entorno: INVID_USER, INVID_PASS (para la cookie de sesión)
 */

const fetch     = require('node-fetch');
const connectDB = require('../db');

const INVID_LOGIN_URL = 'https://www.invidcomputers.com/login.php';
const INVID_BASE_URL  = 'https://www.invidcomputers.com';

// ── Cuántos productos procesar por llamada ────────────────────────────────────
// 100 es un buen balance: ~30-60 segundos de ejecución, no sobrecarga el servidor de Invid.
// En cada llamada siguiente avanza con los próximos 100 sin imagen.
const BATCH_SIZE        = 100;
const CONCURRENT_FETCHES = 10;  // Requests paralelos máximos

// ── Construir URL del producto ────────────────────────────────────────────────
// La URL de Invid sigue el patrón: /{slug}---det--{codigo}
// El slug se genera desde el nombre del producto, idéntico a como lo hace su CMS.

function toInvidSlug(name) {
  let s = name.toLowerCase();
  s = s.replace(/[áàâä]/g, 'a');
  s = s.replace(/[éèêë]/g, 'e');
  s = s.replace(/[íìîï]/g, 'i');
  s = s.replace(/[óòôö]/g, 'o');
  s = s.replace(/[úùûü]/g, 'u');
  s = s.replace(/[ñ]/g, 'n');
  s = s.replace(/[/\\()\[\]°ª°]/g, ' ');
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.trim().replace(/^-+|-+$/g, '');
  return s;
}

function buildProductUrl(name, codigoRaw) {
  // El SKU en la DB es "INVID-0417777" → necesitamos solo "0417777"
  const codigo = codigoRaw.replace(/^INVID-/, '');
  const slug   = toInvidSlug(name);
  return `${INVID_BASE_URL}/${slug}---det--${codigo}`;
}

// ── Login en Invid y obtener cookie de sesión ─────────────────────────────────

async function getInvidCookie() {
  const user = process.env.INVID_USER;
  const pass = process.env.INVID_PASS;
  if (!user || !pass) throw new Error('Faltan INVID_USER o INVID_PASS');

  const body = new URLSearchParams({ usuario: user, password: pass });

  const res = await fetch(INVID_LOGIN_URL, {
    method:   'POST',
    headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:     body.toString(),
    redirect: 'manual',
  });

  const rawCookies = res.headers.raw?.()?.['set-cookie']
    ?? (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);

  if (!rawCookies.length) {
    throw new Error('Invid login: no se recibieron cookies. Verificar INVID_USER y INVID_PASS');
  }

  return rawCookies.map(c => c.split(';')[0].trim()).join('; ');
}

// ── Extraer imagen principal de la página del producto ────────────────────────
// Prioridad:
//   1. og:image meta tag  → más confiable, siempre apunta a la imagen principal
//   2. Primera imagen en .imagen-producto o #imagen-principal (selectores comunes de su CMS)

function extractImageUrl(html, productUrl) {
  if (!html) return null;

  // 1. og:image
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) {
    const url = ogMatch[1].trim();
    if (url.startsWith('http') && !url.includes('logo') && !url.includes('banner')) {
      return url;
    }
  }

  // 2. Primera imagen grande en la galería del producto
  // Su CMS suele tener <img ... src="...images/..."> en la sección principal
  const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']*\/images\/[^"']+)["']/gi)];
  for (const m of imgMatches) {
    const src = m[1].trim();
    if (src && !src.includes('logo') && !src.includes('thumb') && !src.includes('banner')) {
      return src.startsWith('http') ? src : `${INVID_BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
    }
  }

  // 3. Thumbnail si no hay imagen grande
  const thumbMatches = [...html.matchAll(/<img[^>]+src=["']([^"']*\/thumb\/[^"']+)["']/gi)];
  if (thumbMatches[0]?.[1]) {
    const src = thumbMatches[0][1];
    return src.startsWith('http') ? src : `${INVID_BASE_URL}/${src.replace(/^\//, '')}`;
  }

  return null;
}

// ── Fetch de una imagen con reintentos ────────────────────────────────────────

async function fetchProductImage(product, cookieStr) {
  const productUrl = buildProductUrl(product.name, product.sku);

  try {
    const res = await fetch(productUrl, {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (compatible; TovalTechBot/1.0)',
      },
      timeout: 12000,
    });

    if (!res.ok) {
      return { sku: product.sku, imageUrl: null, error: `HTTP ${res.status}` };
    }

    const html = await res.text();

    // Verificar que no redirigió al login (página de login tiene formulario de usuario/clave)
    if (html.includes('name="usuario"') && html.includes('name="password"')) {
      return { sku: product.sku, imageUrl: null, error: 'sesión_inválida' };
    }

    const imageUrl = extractImageUrl(html, productUrl);
    return { sku: product.sku, imageUrl, productUrl, error: imageUrl ? null : 'imagen_no_encontrada' };

  } catch (err) {
    return { sku: product.sku, imageUrl: null, error: err.message };
  }
}

// ── Procesar en paralelo con límite de concurrencia ───────────────────────────

async function processInParallel(items, fn, concurrency) {
  const results = [];
  let i = 0;

  async function runNext() {
    if (i >= items.length) return;
    const item = items[i++];
    const result = await fn(item);
    results.push(result);
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

// ── Handler principal ─────────────────────────────────────────────────────────

module.exports = async function (context, req) {
  const headers = { 'content-type': 'application/json' };

  try {
    const pool = await connectDB();

    // ── 1. Obtener productos de Invid sin imagen ───────────────────────────
    const result = await pool.request().query(`
      SELECT TOP ${BATCH_SIZE} sku, name
      FROM dbo.tovaltech_products
      WHERE provider = 'invid'
        AND (image_url IS NULL OR image_url = '')
      ORDER BY id ASC
    `);

    const products = result.recordset;
    const total_pending_result = await pool.request().query(`
      SELECT COUNT(*) AS cnt
      FROM dbo.tovaltech_products
      WHERE provider = 'invid' AND (image_url IS NULL OR image_url = '')
    `);
    const totalPending = total_pending_result.recordset[0].cnt;

    if (!products.length) {
      context.res = {
        status: 200, headers,
        body: { ok: true, message: 'Todos los productos de Invid ya tienen imagen ✅', processed: 0, found: 0, pending: 0 }
      };
      return;
    }

    context.log.info('invid_images_start', { batch: products.length, total_pending: totalPending });

    // ── 2. Login en Invid ──────────────────────────────────────────────────
    const cookieStr = await getInvidCookie();

    // ── 3. Scraping en paralelo ────────────────────────────────────────────
    const fetchResults = await processInParallel(
      products,
      (p) => fetchProductImage(p, cookieStr),
      CONCURRENT_FETCHES
    );

    // ── 4. Actualizar DB ───────────────────────────────────────────────────
    let found = 0;
    let notFound = 0;

    for (const r of fetchResults) {
      if (r.imageUrl) {
        await pool.request()
          .input('sku',       r.sku)
          .input('image_url', r.imageUrl)
          .query(`
            UPDATE dbo.tovaltech_products
            SET image_url  = @image_url,
                active     = 1,            -- activar ahora que tiene imagen
                updated_at = GETDATE()
            WHERE sku = @sku AND provider = 'invid'
          `);
        found++;
      } else {
        notFound++;
        context.log.warn('invid_image_not_found', { sku: r.sku, error: r.error });
      }
    }

    const remainingAfter = totalPending - found;

    context.log.info('invid_images_complete', { processed: products.length, found, notFound, remaining: remainingAfter });

    context.res = {
      status: 200,
      headers,
      body: {
        ok:         true,
        processed:  products.length,
        found,
        not_found:  notFound,
        pending:    Math.max(0, remainingAfter),
        message:    remainingAfter > 0
          ? `${found} imágenes encontradas. Quedan ${remainingAfter} productos sin imagen — volvé a ejecutar para continuar.`
          : `✅ Listo — todos los productos de Invid tienen imagen.`,
      },
    };

  } catch (err) {
    context.log.error('invid_images_error', err.message);
    context.res = {
      status: 500, headers,
      body: { ok: false, error: err.message },
    };
  }
};
