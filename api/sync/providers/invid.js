const fetch = require('node-fetch');
const XLSX = require('xlsx');
const {
  parseNumber,
  normalizeText,
  round2,
} = require('../lib/common');

const INVID_LOGIN_URL = 'https://www.invidcomputers.com/login.php';
const INVID_EXCEL_URL = 'https://www.invidcomputers.com/genera_excel.php';

async function fetchInvidExcel(user, pass) {
  if (!user || !pass) {
    throw new Error('Faltan variables INVID_USER o INVID_PASS');
  }

  const loginBody = new URLSearchParams({
    usuario: user,
    password: pass,
  });

  const loginRes = await fetch(INVID_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: loginBody.toString(),
    redirect: 'manual',
  });

  const rawCookies = loginRes.headers.raw?.()?.['set-cookie']
    ?? (loginRes.headers.get('set-cookie') ? [loginRes.headers.get('set-cookie')] : []);
  if (!rawCookies.length) {
    throw new Error('Invid login: no se recibieron cookies. Verificar INVID_USER y INVID_PASS');
  }

  const cookieStr = rawCookies
    .map((c) => c.split(';')[0].trim())
    .join('; ');

  const excelRes = await fetch(INVID_EXCEL_URL, {
    headers: { Cookie: cookieStr },
  });
  if (!excelRes.ok) {
    throw new Error(`Invid excel: HTTP ${excelRes.status}. ¿La sesión es válida?`);
  }

  const contentType = excelRes.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('Invid excel: la sesión no es válida (redirigió a login). Verificar credenciales');
  }

  return excelRes.buffer();
}

function parseInvidExcel(buffer, dolar) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const products = [];
  let currentCategory = null;
  let dataStarted = false;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || !row.some((v) => v !== null)) continue;

    const col0 = row[0] != null ? String(row[0]).trim() : '';
    const col1 = row[1] != null ? String(row[1]).trim() : '';

    if (col0 === 'Codigo' || col0 === 'Código') {
      dataStarted = true;
      continue;
    }
    if (!dataStarted) continue;

    if (!col0 && col1 && row[8] == null) {
      currentCategory = col1.replace(/\s*\/\s*/g, '/').trim();
      continue;
    }

    if (!col0 || !/^\d+$/.test(col0)) continue;

    const priceUsd = parseNumber(row[8]);
    const name = normalizeText(row[1]);
    if (!priceUsd || !name) continue;

    const cleanName = name.replace(/\s*\(\d{4,}\)\s*$/, '').trim();
    const sku = `INVID-${col0}`;

    products.push({
      sku,
      name: cleanName,
      category: currentCategory,
      brand: normalizeText(row[2]),
      price_usd: round2(priceUsd),
      price_ars: Math.max(0, Math.round(priceUsd * dolar)),
      stock: 0,
      image_url: null,
      provider: 'invid',
      warranty: null,
      dolar_rate: round2(dolar),
    });
  }

  return products;
}

async function fetchInvidProducts(user, pass, dolar) {
  const buffer = await fetchInvidExcel(user, pass);
  return parseInvidExcel(buffer, dolar);
}

module.exports = {
  fetchInvidProducts,
};
