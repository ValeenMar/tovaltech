// FILE: api/health/index.js
const connectDB = require("../db");

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();
    const r = await pool.request().query("SELECT 1 AS ok");
    context.res = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: {
        ok: true,
        db: r.recordset?.[0]?.ok === 1,
        env: {
          DB_SERVER: !!process.env.DB_SERVER,
          DB_NAME: !!process.env.DB_NAME,
          DB_USER: !!process.env.DB_USER,
          DB_PASSWORD: !!process.env.DB_PASSWORD,
          DB_PORT: !!process.env.DB_PORT,
        },
      },
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers: { "content-type": "application/json" },
      body: { ok: false, message: err.message, stack: err.stack },
    };
  }
};
