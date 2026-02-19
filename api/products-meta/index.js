// FILE: api/products-meta/index.js
const connectDB = require("../db");

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const q = `
      SELECT DISTINCT category AS v FROM dbo.tovaltech_products WHERE category IS NOT NULL AND LTRIM(RTRIM(category)) <> '' ORDER BY v;
      SELECT DISTINCT brand    AS v FROM dbo.tovaltech_products WHERE brand IS NOT NULL AND LTRIM(RTRIM(brand)) <> '' ORDER BY v;
      SELECT DISTINCT provider AS v FROM dbo.tovaltech_products WHERE provider IS NOT NULL AND LTRIM(RTRIM(provider)) <> '' ORDER BY v;
    `;

    const result = await pool.request().query(q);

    context.res = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: {
        categories: (result.recordsets?.[0] || []).map((r) => r.v),
        brands: (result.recordsets?.[1] || []).map((r) => r.v),
        providers: (result.recordsets?.[2] || []).map((r) => r.v),
      },
    };
  } catch (err) {
    context.log.error("products_meta_failed", err);
    context.res = {
      status: 500,
      headers: { "content-type": "application/json" },
      body: { error: "products_meta_failed", message: err.message, stack: err.stack },
    };
  }
};