const statusStyles = {
  active: 'bg-green-100 text-green-800',
  shipped: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function StatusBadge({ status, text }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
      {text}
    </span>
  )
}