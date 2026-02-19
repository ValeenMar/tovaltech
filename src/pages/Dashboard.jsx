import { useApp } from '../context/AppContext'
import StatCard from '../components/ui/StatCard'
import { weeklyChartData, activityFeed } from '../data/mockData'

const chartColors = ['#0078d4','#6c63ff','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6']

export default function Dashboard() {
  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon="💰" iconBg="bg-blue-100" value="$48,250" label="Ingresos del mes" change="12.5%" up />
        <StatCard icon="📦" iconBg="bg-green-100" value="384" label="Pedidos totales" change="8.2%" up />
        <StatCard icon="👥" iconBg="bg-yellow-100" value="1,248" label="Clientes activos" change="24.1%" up />
        <StatCard icon="🏷️" iconBg="bg-pink-100" value="156" label="Productos en stock" change="3.1%" up={false} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="font-semibold mb-4">Ventas semanales</h3>
          <div className="flex items-end gap-2 h-40">
            {weeklyChartData.map((d, i) => {
              const max = Math.max(...weeklyChartData.map(x => x.value))
              return (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-md transition-all duration-500 hover:opacity-80"
                    style={{ height: `${(d.value / max) * 100}%`, background: chartColors[i] }}
                    title={`${d.label}: ${d.value}`}
                  />
                  <span className="text-[10px] text-gray-400">{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="font-semibold mb-4">Estado de pedidos</h3>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="w-32 h-32 rounded-full relative" style={{
              background: 'conic-gradient(#10b981 0% 45%, #0078d4 45% 72%, #f59e0b 72% 88%, #ef4444 88% 100%)'
            }}>
              <div className="absolute inset-0 m-auto w-[70px] h-[70px] bg-white rounded-full flex flex-col items-center justify-center">
                <strong className="text-lg">384</strong>
                <small className="text-[10px] text-gray-400">Total</small>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              {[['#10b981','Entregados','45%'],['#0078d4','En camino','27%'],['#f59e0b','Pendientes','16%'],['#ef4444','Cancelados','12%']].map(([c,l,p]) => (
                <div key={l} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  {l} {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 font-semibold">🕐 Actividad reciente</div>
        <div className="px-5 py-2">
          {activityFeed.map((a, i) => (
            <div key={i} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${a.bg}`}>
                {a.icon}
              </div>
              <div>
                <p className="text-sm" dangerouslySetInnerHTML={{ __html: a.text }} />
                <time className="text-xs text-gray-400">{a.time}</time>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}