module.exports = async function (context, req) {
  // En producción: conectar a Azure SQL
  // const { Connection, Request } = require('tedious')

  if (req.method === 'GET') {
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'GET /api/orders — Conectar a Azure SQL aquí' }
    }
  }

  if (req.method === 'POST') {
    const body = req.body
    context.res = {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Pedido creado', data: body }
    }
  }
}