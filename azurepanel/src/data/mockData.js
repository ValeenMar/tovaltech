export const orders = [
  { id: '#1084', customer: 'María López', product: 'Laptop Pro X', total: '$1,299', status: 'active', statusText: 'Entregado', date: '18 Feb 2026' },
  { id: '#1083', customer: 'Carlos Ruiz', product: 'Monitor 4K', total: '$549', status: 'shipped', statusText: 'En camino', date: '17 Feb 2026' },
  { id: '#1082', customer: 'Ana García', product: 'Teclado RGB', total: '$89', status: 'pending', statusText: 'Pendiente', date: '17 Feb 2026' },
  { id: '#1081', customer: 'Luis Pérez', product: 'Mouse Wireless', total: '$45', status: 'active', statusText: 'Entregado', date: '16 Feb 2026' },
  { id: '#1080', customer: 'Sofia Torres', product: 'Webcam HD', total: '$129', status: 'cancelled', statusText: 'Cancelado', date: '16 Feb 2026' },
  { id: '#1079', customer: 'Diego Morales', product: 'Auriculares BT', total: '$199', status: 'shipped', statusText: 'En camino', date: '15 Feb 2026' },
  { id: '#1078', customer: 'Laura Sánchez', product: 'SSD 1TB', total: '$89', status: 'active', statusText: 'Entregado', date: '15 Feb 2026' },
  { id: '#1077', customer: 'Pedro Vargas', product: 'Tablet Air', total: '$699', status: 'pending', statusText: 'Pendiente', date: '14 Feb 2026' },
]

export const products = [
  { name: 'Laptop Pro X', emoji: '💻', price: '$1,299', stock: 3, category: 'Computadoras' },
  { name: 'Monitor 4K 27"', emoji: '🖥️', price: '$549', stock: 18, category: 'Pantallas' },
  { name: 'Teclado Mecánico', emoji: '⌨️', price: '$89', stock: 42, category: 'Periféricos' },
  { name: 'Mouse Wireless', emoji: '🖱️', price: '$45', stock: 67, category: 'Periféricos' },
  { name: 'Auriculares BT', emoji: '🎧', price: '$199', stock: 25, category: 'Audio' },
  { name: 'Webcam HD Pro', emoji: '📷', price: '$129', stock: 15, category: 'Video' },
  { name: 'SSD 1TB NVMe', emoji: '💾', price: '$89', stock: 54, category: 'Almacenamiento' },
  { name: 'Tablet Air 11"', emoji: '📱', price: '$699', stock: 8, category: 'Tablets' },
  { name: 'Cargador USB-C', emoji: '🔌', price: '$35', stock: 120, category: 'Accesorios' },
  { name: 'Hub USB 7-en-1', emoji: '🔗', price: '$59', stock: 33, category: 'Accesorios' },
]

export const customers = [
  { id: 'B2C-001', name: 'María López', email: 'maria@email.com', orders: 12, spent: '$4,280', status: 'active' },
  { id: 'B2C-002', name: 'Carlos Ruiz', email: 'carlos@email.com', orders: 3, spent: '$890', status: 'active' },
  { id: 'B2C-003', name: 'Ana García', email: 'ana@email.com', orders: 8, spent: '$2,145', status: 'active' },
  { id: 'B2C-004', name: 'Luis Pérez', email: 'luis@email.com', orders: 1, spent: '$45', status: 'pending' },
  { id: 'B2C-005', name: 'Sofia Torres', email: 'sofia@email.com', orders: 15, spent: '$6,720', status: 'active' },
  { id: 'B2C-006', name: 'Diego Morales', email: 'diego@email.com', orders: 0, spent: '$0', status: 'pending' },
]

export const invoices = [
  { id: 'FAC-2026-089', customer: 'María López', amount: '$1,299', date: '18 Feb 2026', status: 'active', statusText: 'Pagada' },
  { id: 'FAC-2026-088', customer: 'Carlos Ruiz', amount: '$549', date: '17 Feb 2026', status: 'pending', statusText: 'Pendiente' },
  { id: 'FAC-2026-087', customer: 'Ana García', amount: '$89', date: '17 Feb 2026', status: 'pending', statusText: 'Pendiente' },
  { id: 'FAC-2026-086', customer: 'Luis Pérez', amount: '$45', date: '16 Feb 2026', status: 'active', statusText: 'Pagada' },
  { id: 'FAC-2026-085', customer: 'Sofia Torres', amount: '$129', date: '16 Feb 2026', status: 'cancelled', statusText: 'Anulada' },
  { id: 'FAC-2026-084', customer: 'Diego Morales', amount: '$199', date: '15 Feb 2026', status: 'active', statusText: 'Pagada' },
]

export const weeklyChartData = [
  { label: 'Lun', value: 42 },
  { label: 'Mar', value: 58 },
  { label: 'Mié', value: 35 },
  { label: 'Jue', value: 71 },
  { label: 'Vie', value: 89 },
  { label: 'Sáb', value: 63 },
  { label: 'Dom', value: 28 },
]

export const revenueChartData = [
  { label: 'Sep', value: 32 },
  { label: 'Oct', value: 45 },
  { label: 'Nov', value: 67 },
  { label: 'Dic', value: 89 },
  { label: 'Ene', value: 72 },
  { label: 'Feb', value: 48 },
]

export const activityFeed = [
  { icon: '✅', bg: 'bg-green-100', text: '<strong>Pedido #1084</strong> entregado a María López', time: 'Hace 12 min' },
  { icon: '📧', bg: 'bg-blue-100', text: 'Factura <strong>FAC-2026-089</strong> enviada vía SWA API', time: 'Hace 34 min' },
  { icon: '🆕', bg: 'bg-yellow-100', text: 'Nuevo cliente: <strong>Carlos Ruiz</strong> (Azure AD B2C)', time: 'Hace 1 hora' },
  { icon: '⚠️', bg: 'bg-pink-100', text: 'Stock bajo: <strong>Laptop Pro X</strong> — 3 unidades', time: 'Hace 2 horas' },
]