import StatCard from '../components/ui/StatCard'
import { revenueChartData } from '../data/mockData'

const colors = ['#6c63ff','#0078d4','#10b981','#f59e0b','#ef4444','#ec4899']
const topProducts = [
  { name: 'Laptop Pro X', sales: 84, pct: 100 },
  { name: 'Monitor 4K', sales: 62, pct: 74 },
  { name: 'Auriculares BT', sales: 51, pct: 61 },
  { name: 'Tablet Air', sales: 38, pct: 45 },
  { name: 'Teclado Mecánico', sales: 29, pct: 35 },
]
const archCards = [
  { emoji: '⚛️', title: 'React + Vite', desc: 'Frontend SPA', bg: 'bg-blue-50', tag: 'Incluido en SWA' },
  { emoji: '🔗', title: 'SWA API Routes', desc: 'Backend /api', bg: 'bg-green-50', tag: '✅ GRATIS' },
  { emoji: '🗄️', title: 'Azure SQL', desc: 'Base de datos', bg: 'bg-yellow-50', tag: '✅ GRATIS 12m' },
  { emoji: '🔐', title: 'AD B2C', desc: 'Autenticación', bg: 'bg-pink-50', tag: '✅ 50K gratis' },
  { emoji: '📁', title: 'Blob Storage', desc: 'Facturas', bg: 'bg-purple-50', tag: '✅ 5GB gratis' },
  { emoji: '📧', title: 'Comm. Services', desc: 'Emails', bg: 'bg-emerald-50', tag: '✅ GRATIS' },
]

export default function Analytics() {
  const max = Math.max(...revenueChartData.map(d => d.value))

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon="🌐" iconBg="bg-blue-100" value="12.4K" label="Visitas / mes" change="18%" up />
        <StatCard icon="🔄" iconBg="bg-green-100" value="3.8%" label="Tasa conversión" change="5.2%" up />
        <StatCard icon="⏱️" iconBg="bg-yellow-100" value="2m 34s" label="Tiempo promedio" change="12%" up={false} />
        <StatCard icon="📧" iconBg="bg-pink-100" value="94.2%" label="Emails entregados" change="9%" up />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="font-semibold mb-4">📈 Ingresos mensuales</h3>
          <div className="flex items-end gap-2 h-40">
            {revenueChartData.map((d, i) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-md hover:opacity-80 transition-all duration-500"
                  style={{ height: `${(d.value / max) * 100}%`, background: colors[i] }} />
                <span className="text-[10px] text-gray-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="font-semibold mb-4">🏆 Top Productos</h3>
          {topProducts.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3 py-2">
              <span className="text-xs text-gray-400 w-5">#{i + 1}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold mb-1">{p.name}</div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-azure-500 to-violet-500" style={{ width: `${p.pct}%` }} />
                </div>
              </div>
              <span className="text-sm font-semibold">{p.sales}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <h3 className="font-semibold mb-4">⚡ Arquitectura Azure — Todo Gratis</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {archCards.map(c => (
            <div key={c.title} className={`${c.bg} rounded-lg p-4 text-center`}>
              <div className="text-3xl mb-1">{c.emoji}</div>
              <strong className="text-xs">{c.title}</strong><br />
              <small className="text-gray-400 text-[11px]">{c.desc}</small><br />
              <span className="inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-bold">{c.tag}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3.5 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg text-sm border border-dashed border-azure-500">
          <strong>💡 Cambio clave:</strong> En vez de Azure Functions, usamos las <strong>API Routes integradas de Static Web Apps</strong>.
          Solo creas una carpeta <code className="bg-white px-1 rounded">/api</code> y Azure despliega las funciones automáticamente.
        </div>
      </div>
    </>
  )
}