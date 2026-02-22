const fetch = require('node-fetch');
const { parseCsv, rowsToObjects } = require('../lib/csv');
const {
  parseNumber,
  parseIntSafe,
  normalizeText,
  round2,
} = require('../lib/common');

function mapNewBytes(row, dolar) {
  const sku = normalizeText(row.CODIGO);
  const name = normalizeText(row.DETALLE_USUARIO || row.DETALLE);
  const category = normalizeText(row.CATEGORIA_USUARIO || row.CATEGORIA);
  const brand = normalizeText(row.MARCA);
  const priceUsd = parseNumber(row['PRECIO USD CON UTILIDAD'] || row['PRECIO FINAL']);
  const priceArs = parseNumber(row['PRECIO PESOS CON UTILIDAD'] || row['PRECIO PESOS CON IVA']);
  const stock = parseIntSafe(row.STOCK, 0);
  const imageUrl = normalizeText(row.IMAGEN);
  const warranty = normalizeText(row.GARANTIA);

  if (!sku || !name || !priceUsd) return null;

  return {
    sku,
    name,
    category,
    brand,
    price_usd: round2(priceUsd),
    price_ars: Math.max(0, Math.round(priceArs ?? priceUsd * dolar)),
    stock,
    image_url: imageUrl,
    provider: 'newbytes',
    warranty,
    dolar_rate: round2(dolar),
  };
}

async function fetchNewBytesProducts(url, dolar) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
  const csv = await res.text();
  return rowsToObjects(parseCsv(csv, ';'))
    .map((row) => mapNewBytes(row, dolar))
    .filter(Boolean);
}

module.exports = {
  fetchNewBytesProducts,
};
