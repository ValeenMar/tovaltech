// FILE: api/products/index.js
const connectDB = require("../db");

function toInt(v, fallback) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const categoria = (req.query.categoria || "").trim();
    const marca = (req.query.marca || "").trim();
    const proveedor = (req.query.proveedor || "").trim();
    const buscar = (req.query.buscar || "").trim();

    const limit = clamp(toInt(req.query.limit, 24), 1, 200);
    const offset = Math.max(0, toInt(req.query.offset, 0));

    const where = ["stock > 0"];
    if (categoria) where.push("category = @categoria");
    if (marca) where.push("brand = @marca");
    if (proveedor) where.push("provider = @proveedor");
    if (buscar) where.push("(name LIKE @buscar OR brand LIKE @buscar OR sku LIKE @buscar)");
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const countReq = pool.request();
    if (categoria) countReq.input("categoria", categoria);
    if (marca) countReq.input("marca", marca);
    if (proveedor) countReq.input("proveedor", proveedor);
    if (buscar) countReq.input("buscar", `%${buscar}%`);

    const count = await countReq.query(
      `SELECT COUNT(1) AS total FROM dbo.tovaltech_products ${whereSql}`
    );
    const total = count.recordset?.[0]?.total ?? 0;

    const itemsReq = pool.request();
    if (categoria) itemsReq.input("categoria", categoria);
    if (marca) itemsReq.input("marca", marca);
    if (proveedor) itemsReq.input("proveedor", proveedor);
    if (buscar) itemsReq.input("buscar", `%${buscar}%`);
    itemsReq.input("offset", offset);
    itemsReq.input("limit", limit);

    const items = await itemsReq.query(`
      SELECT *
      FROM dbo.tovaltech_products
      ${whereSql}
      ORDER BY updated_at DESC, id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    context.res = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: { items: items.recordset || [], total, limit, offset },
    };
  } catch (err) {
    context.log.error("products_failed", err);
    context.res = {
      status: 500,
      headers: { "content-type": "application/json" },
      body: {
        error: "products_failed",
        message: err.message,
        stack: err.stack, // en prod después lo sacamos si querés
      },
    };
  }
};
