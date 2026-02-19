// FILE: api/db.js
const sql = require("mssql");

let poolPromise;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getConfig() {
  const server = requireEnv("DB_SERVER");
  const database = requireEnv("DB_NAME");
  const user = requireEnv("DB_USER");
  const password = requireEnv("DB_PASSWORD");
  const port = parseInt(process.env.DB_PORT || "1433", 10);

  return {
    server,
    database,
    user,
    password,
    port,
    options: {
      encrypt: true, // Azure SQL requiere TLS
      trustServerCertificate: false,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 30000,
    connectionTimeout: 30000,
  };
}

async function connectDB() {
  if (!poolPromise) {
    const config = getConfig();
    poolPromise = sql
      .connect(config)
      .then((pool) => pool)
      .catch((err) => {
        poolPromise = undefined; // allow retry
        throw err;
      });
  }
  return poolPromise;
}

module.exports = connectDB;
