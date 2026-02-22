const fetch = require('node-fetch');
const { parseCsv, rowsToObjects } = require('../lib/csv');
const {
  parseNumber,
  parseIntSafe,
  normalizeText,
  round2,
} = require('../lib/common');

function mapElit(row, dolar) {
  const sku = normalizeText(row.codigo_alfa);
  const name = normalizeText(row.nombre);
  const category = normalizeText(row.categoria);
  const brand = normalizeText(row.marca);
  const priceUsd = parseNumber(row.pvp_usd);
  const stock = parseIntSafe(row.stock_total, 0);
  const imageUrl = normalizeText(row.imagen);
  const warranty = normalizeText(row.garantia);

  if (!sku || !name || !priceUsd) return null;

  return {
    sku,
    name,
    category,
    brand,
    price_usd: round2(priceUsd),
    price_ars: Math.max(0, Math.round(priceUsd * dolar)),
    stock,
    image_url: imageUrl,
    provider: 'elit',
    warranty,
    dolar_rate: round2(dolar),
  };
}

async function fetchElitProducts(url, dolar) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
  const csv = await res.text();
  return rowsToObjects(parseCsv(csv, ','))
    .map((row) => mapElit(row, dolar))
    .filter(Boolean);
}

module.exports = {
  fetchElitProducts,
};
