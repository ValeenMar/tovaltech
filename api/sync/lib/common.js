function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === '-') return null;

  let normalized;
  if (s.includes(',')) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = s.replace(/[^0-9.]/g, '');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseIntSafe(value, fallback = 0) {
  const n = Number.parseInt(String(value || '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  const s = String(value ?? '').trim();
  return s.length ? s : null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  parseNumber,
  parseIntSafe,
  normalizeText,
  round2,
};
