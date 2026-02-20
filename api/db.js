// api/db.js
// Conexión a Azure SQL con keep-alive para evitar los 500 intermitentes
// por cold start del pool cuando la conexión se duerme.

const sql = require('mssql');

const config = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt:                true,
    trustServerCertificate: false,
    connectTimeout:         30000,
    requestTimeout:         30000,
  },
  pool: {
    max:             10,
    min:             1,
    idleTimeoutMillis: 60000,   // cierra conexiones inactivas después de 60s
    acquireTimeoutMillis: 30000,
  },
};

let pool = null;
let lastPing = 0;
const PING_INTERVAL = 4 * 60 * 1000; // ping cada 4 minutos para que no se duerma

async function connectDB() {
  try {
    // Si el pool no existe o está cerrado, lo recreamos
    if (!pool || !pool.connected) {
      pool = await sql.connect(config);
    }

    // Keep-alive: cada 4 minutos hacemos un SELECT 1 para mantener viva la conexión
    const now = Date.now();
    if (now - lastPing > PING_INTERVAL) {
      await pool.request().query('SELECT 1');
      lastPing = now;
    }

    return pool;
  } catch (err) {
    // Si falla, limpiamos el pool para forzar reconexión en el próximo intento
    pool = null;
    throw err;
  }
}

module.exports = connectDB;
