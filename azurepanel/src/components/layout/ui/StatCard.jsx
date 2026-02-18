export default function StatCard({ icon, iconBg, value, label, change, up }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-default">
      <div className="flex justify-between items-center mb-3">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl ${iconBg}`}>
          {icon}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
          up ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {up ? '↑' : '↓'} {change}
        </span>
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}