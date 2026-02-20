// api/dashboard/index.js
// Devuelve estadísticas reales para el panel admin.

const connectDB = require('../db');

module.exports = async function (context, req) {
  const headers = { 'content-type': 'application/json' };

  try {
    const pool = await connectDB();

    const result = await pool.request().query(`
      -- Totales de pedidos
      SELECT
        COUNT(*)                                              AS total_orders,
        SUM(CASE WHEN status = 'paid'      THEN 1 ELSE 0 END) AS paid_orders,
        SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending_orders,
        SUM(CASE WHEN status = 'shipped'   THEN 1 ELSE 0 END) AS shipped_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
        ISNULL(SUM(CASE WHEN mp_status = 'approved' THEN total_ars ELSE 0 END), 0) AS revenue_total,
        ISNULL(SUM(CASE WHEN mp_status = 'approved'
          AND created_at >= DATEADD(day, -30, GETDATE())
          THEN total_ars ELSE 0 END), 0)                     AS revenue_30d,
        COUNT(DISTINCT buyer_email)                           AS unique_customers
      FROM dbo.tovaltech_orders;

      -- Productos
      SELECT
        COUNT(*)                                              AS total_products,
        SUM(CASE WHEN stock = 0  THEN 1 ELSE 0 END)           AS out_of_stock,
        SUM(CASE WHEN stock > 0 AND stock <= 3 THEN 1 ELSE 0 END) AS low_stock,
        SUM(CASE WHEN stock > 3  THEN 1 ELSE 0 END)           AS in_stock
      FROM dbo.tovaltech_products;

      -- Últimos 7 días de pedidos (para el gráfico)
      SELECT
        CAST(created_at AS DATE)                              AS day,
        COUNT(*)                                              AS orders,
        ISNULL(SUM(CASE WHEN mp_status = 'approved' THEN total_ars ELSE 0 END), 0) AS revenue
      FROM dbo.tovaltech_orders
      WHERE created_at >= DATEADD(day, -6, CAST(GETDATE() AS DATE))
      GROUP BY CAST(created_at AS DATE)
      ORDER BY day ASC;

      -- Pedidos recientes
      SELECT TOP 8
        id, buyer_name, buyer_lastname, buyer_email,
        total_ars, status, mp_status, created_at
      FROM dbo.tovaltech_orders
      ORDER BY created_at DESC;

      -- Productos con stock crítico (≤ 3)
      SELECT TOP 5
        id, name, brand, category, stock, image_url
      FROM dbo.tovaltech_products
      WHERE stock > 0 AND stock <= 3
      ORDER BY stock ASC;
    `);

    const stats        = result.recordsets[0]?.[0] ?? {};
    const productStats = result.recordsets[1]?.[0] ?? {};
    const dailyData    = result.recordsets[2] ?? [];
    const recentOrders = result.recordsets[3] ?? [];
    const lowStock     = result.recordsets[4] ?? [];

    context.res = {
      status: 200,
      headers,
      body: {
        orders: {
          total:     stats.total_orders     ?? 0,
          paid:      stats.paid_orders      ?? 0,
          pending:   stats.pending_orders   ?? 0,
          shipped:   stats.shipped_orders   ?? 0,
          delivered: stats.delivered_orders ?? 0,
          cancelled: stats.cancelled_orders ?? 0,
        },
        revenue: {
          total: parseFloat(stats.revenue_total ?? 0),
          last30d: parseFloat(stats.revenue_30d ?? 0),
        },
        customers: {
          unique: stats.unique_customers ?? 0,
        },
        products: {
          total:      productStats.total_products ?? 0,
          in_stock:   productStats.in_stock       ?? 0,
          low_stock:  productStats.low_stock      ?? 0,
          out_of_stock: productStats.out_of_stock ?? 0,
        },
        daily_chart: dailyData.map(d => ({
          label:   new Date(d.day).toLocaleDateString('es-AR', { weekday: 'short' }),
          date:    d.day,
          orders:  d.orders,
          revenue: parseFloat(d.revenue),
        })),
        recent_orders: recentOrders,
        low_stock_products: lowStock,
      },
    };

  } catch (err) {
    context.log.error('dashboard_error', err.message);
    context.res = {
      status: 500,
      headers,
      body: { error: 'dashboard_failed', message: 'Error al cargar el dashboard.' },
    };
  }
};
