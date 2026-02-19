const fetch = require('node-fetch');

module.exports = async function (context, req) {
  try {
    // Test 1: ¿fetch funciona?
    const dolarRes = await fetch('https://dolarapi.com/v1/dolares/oficial');
    const dolar = await dolarRes.json();

    // Test 2: ¿las variables de entorno están?
    context.res = {
      status: 200,
      body: {
        dolar: dolar.venta,
        db_server: process.env.DB_SERVER || 'NO ENCONTRADO',
        db_name: process.env.DB_NAME || 'NO ENCONTRADO',
        db_user: process.env.DB_USER || 'NO ENCONTRADO',
        db_port: process.env.DB_PORT || 'NO ENCONTRADO',
      }
    };
  } catch (err) {
    context.res = {
      status: 500,
      body: { error: err.message, stack: err.stack }
    };
  }
};