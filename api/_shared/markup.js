const CATEGORY_TABLE = 'dbo.tovaltech_categories';
const MARKUP_TTL = 2 * 60 * 1000;

let markupCache = null;
let markupCacheTime = 0;

function invalidateMarkupCache() {
  markupCache = null;
  markupCacheTime = 0;
}

async function getMarkupSettings(pool, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && markupCache && (now - markupCacheTime) < MARKUP_TTL) {
    return markupCache;
  }

  const settingsRes = await pool.request().query(
    "SELECT value FROM dbo.tovaltech_settings WHERE key_name = 'global_markup_pct'"
  );
  const catRes = await pool.request().query(
    `SELECT id, name, markup_pct, parent_id FROM ${CATEGORY_TABLE}`
  );

  const globalMarkupPct = parseFloat(settingsRes.recordset?.[0]?.value ?? '0');

  const catById = {};
  for (const row of catRes.recordset || []) {
    catById[row.id] = {
      name: String(row.name ?? '').trim(),
      markup_pct: row.markup_pct,
      parent_id: row.parent_id,
    };
  }

  const categoryMarkup = {};
  for (const cat of Object.values(catById)) {
    if (!cat.name) continue;
    let pct = cat.markup_pct !== null && cat.markup_pct !== undefined
      ? parseFloat(cat.markup_pct)
      : null;

    if ((pct === null || !Number.isFinite(pct)) && cat.parent_id) {
      const parent = catById[cat.parent_id];
      if (parent && parent.markup_pct !== null && parent.markup_pct !== undefined) {
        pct = parseFloat(parent.markup_pct);
      }
    }

    if (pct !== null && Number.isFinite(pct)) {
      categoryMarkup[cat.name] = pct / 100;
    }
  }

  markupCache = {
    globalMarkup: globalMarkupPct / 100,
    categoryMarkup,
  };
  markupCacheTime = now;
  return markupCache;
}

function computeEffectiveMarkup(product, settings) {
  const categoryKey = String(product.category ?? '').trim();

  if (product.markup_pct !== null && product.markup_pct !== undefined) {
    return { markup: Number(product.markup_pct) / 100, source: 'product' };
  }
  if (categoryKey && settings.categoryMarkup[categoryKey] !== undefined) {
    return { markup: settings.categoryMarkup[categoryKey], source: 'category' };
  }
  return { markup: settings.globalMarkup, source: 'global' };
}

function applyMarkup(product, settings) {
  const { markup, source } = computeEffectiveMarkup(product, settings);
  const multiplier = 1 + markup;
  const priceArsSale = Math.round((product.price_ars ?? 0) * multiplier);
  const priceUsdSale = Math.round((product.price_usd ?? 0) * multiplier * 100) / 100;

  return {
    ...product,
    price_ars: priceArsSale,
    price_usd: priceUsdSale,
    markup_applied: Math.round(markup * 100 * 10) / 10,
    markup_source: source,
    active: product.active !== 0,
  };
}

module.exports = {
  MARKUP_TTL,
  invalidateMarkupCache,
  getMarkupSettings,
  applyMarkup,
};
