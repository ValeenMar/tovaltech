// api/customers/index.js
// Lista clientes únicos extraídos de los pedidos reales de MP.

const connectDB = require('../db');

module.exports = async function (context, req) {
  const headers = { 'content-type': 'application/json' };

  try {
    const pool = await connectDB();

    const result = await pool.request().query(`
      SELECT
        buyer_email                                               AS email,
        MAX(buyer_name)                                           AS first_name,
        MAX(buyer_lastname)                                       AS last_name,
        MAX(buyer_phone)                                          AS phone,
        MAX(buyer_zone)                                           AS zone,
        MAX(buyer_city)                                           AS city,
        COUNT(*)                                                  AS total_orders,
        SUM(CASE WHEN mp_status = 'approved' THEN 1 ELSE 0 END)  AS paid_orders,
        ISNULL(SUM(CASE WHEN mp_status = 'approved' THEN total_ars ELSE 0 END), 0) AS total_spent,
        MIN(created_at)                                           AS first_order,
        MAX(created_at)                                           AS last_order
      FROM dbo.tovaltech_orders
      WHERE buyer_email IS NOT NULL
      GROUP BY buyer_email
      ORDER BY last_order DESC
    `);

    const customers = (result.recordset || []).map(c => ({
      email:        c.email,
      name:         `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(),
      phone:        c.phone,
      zone:         c.zone,
      city:         c.city,
      total_orders: c.total_orders,
      paid_orders:  c.paid_orders,
      total_spent:  parseFloat(c.total_spent ?? 0),
      first_order:  c.first_order,
      last_order:   c.last_order,
    }));

    context.res = {
      status: 200,
      headers,
      body: { customers, total: customers.length },
    };

  } catch (err) {
    context.log.error('customers_error', err.message);
    context.res = {
      status: 500,
      headers,
      body: { error: 'customers_failed', message: 'Error al cargar clientes.' },
    };
  }
};
