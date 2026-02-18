module.exports = async function (context, req) {
  if (req.method === 'GET') {
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'GET /api/products — Conectar a Azure SQL aquí' }
    }
  }

  if (req.method === 'POST') {
    context.res = {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Producto creado', data: req.body }
    }
  }
}