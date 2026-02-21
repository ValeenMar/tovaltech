// api/analytics/index.js
// GET /api/analytics — datos reales para la página de analíticas del admin.
//
// Devuelve:
//   monthly_revenue  → ingresos por mes (últimos 6 meses)
//   top_products     → top 10 productos por ingresos (parsea items_json)
//   zone_breakdown   → pedidos y revenue por zona de envío
//   status_breakdown → distribución de pedidos por estado
//
// Protegido con allowedRoles: ["admin"] en staticwebapp.config.json

const connectDB = require('../db');

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

module.exports = async function (context, req) {
  const headers = { 'content-type': 'application/json' };

  try {
    const pool = await connectDB();

    const result = await pool.request().query(`
      -- ── 1. Ingresos mensuales últimos 6 meses ──────────────────────────────
      SELECT
        YEAR(created_at)  AS yr,
        MONTH(created_at) AS mo,
        COUNT(*)          AS orders,
        ISNULL(SUM(CASE WHEN mp_status = 'approved' THEN total_ars ELSE 0 END), 0) AS revenue
      FROM dbo.tovaltech_orders
      WHERE created_at >= DATEADD(month, -5, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
      GROUP BY YEAR(created_at), MONTH(created_at)
      ORDER BY yr ASC, mo ASC;

      -- ── 2. Top 10 productos por ingresos (via OPENJSON) ─────────────────────
      -- items_json es un array: [{id, title, quantity, unit_price, currency_id}, ...]
      SELECT TOP 10
        p.title,
        COUNT(DISTINCT o.id) AS order_count,
        SUM(p.quantity)      AS units_sold,
        SUM(p.unit_price * p.quantity) AS revenue
      FROM dbo.tovaltech_orders o
      CROSS APPLY OPENJSON(o.items_json) WITH (
        title      NVARCHAR(300) '$.title',
        quantity   INT           '$.quantity',
        unit_price DECIMAL(12,2) '$.unit_price',
        item_id    NVARCHAR(100) '$.id'
      ) p
      WHERE o.mp_status = 'approved'
        AND o.items_json IS NOT NULL
        AND p.item_id != 'shipping'
        AND p.title IS NOT NULL
      GROUP BY p.title
      ORDER BY revenue DESC;

      -- ── 3. Desglose por zona ────────────────────────────────────────────────
      SELECT
        ISNULL(buyer_zone, 'Sin datos') AS zone,
        COUNT(*)  AS orders,
        ISNULL(SUM(CASE WHEN mp_status = 'approved' THEN total_ars ELSE 0 END), 0) AS revenue
      FROM dbo.tovaltech_orders
      GROUP BY buyer_zone
      ORDER BY orders DESC;

      -- ── 4. Distribución por estado ──────────────────────────────────────────
      SELECT
        status,
        COUNT(*) AS total
      FROM dbo.tovaltech_orders
      GROUP BY status
      ORDER BY total DESC;
    `);

    // ── Formatear resultados ──────────────────────────────────────────────────

    const monthlyRevenue = (result.recordsets[0] || []).map(r => ({
      label:   `${MONTH_NAMES[r.mo - 1]} ${r.yr}`,
      year:    r.yr,
      month:   r.mo,
      orders:  r.orders,
      revenue: parseFloat(r.revenue),
    }));

    const topProducts = (result.recordsets[1] || []).map(r => ({
      title:       r.title,
      order_count: r.order_count,
      units_sold:  r.units_sold,
      revenue:     parseFloat(r.revenue),
    }));

    const zoneBreakdown = (result.recordsets[2] || []).map(r => ({
      zone:    r.zone,
      orders:  r.orders,
      revenue: parseFloat(r.revenue),
    }));

    const statusBreakdown = (result.recordsets[3] || []).map(r => ({
      status: r.status,
      total:  r.total,
    }));

    context.res = {
      status: 200,
      headers,
      body: {
        monthly_revenue:  monthlyRevenue,
        top_products:     topProducts,
        zone_breakdown:   zoneBreakdown,
        status_breakdown: statusBreakdown,
      },
    };

  } catch (err) {
    context.log.error('analytics_error', err.message);
    context.res = {
      status: 500,
      headers,
      body: { error: 'analytics_failed', message: err.message },
    };
  }
};
