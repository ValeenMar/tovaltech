import { createContext, useContext, useState, useReducer } from 'react'
import { orders as initOrders, customers as initCustomers, invoices as initInvoices } from '../data/mockData'
import { products as initProducts } from '../data/products'

const AppContext = createContext()

const modalReducer = (state, action) => {
  switch (action.type) {
    case 'OPEN':
      return { isOpen: true, modalType: action.modalType, data: action.data || null }
    case 'CLOSE':
      return { isOpen: false, modalType: null, data: null }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [orders, setOrders] = useState(initOrders)

  // ── Productos: fuente única para admin Y tienda ──────────────────────────
  const [products, setProducts] = useState(initProducts)

  const [customers, setCustomers] = useState(initCustomers)
  const [invoices] = useState(initInvoices)
  const [modal, dispatchModal] = useReducer(modalReducer, {
    isOpen: false, modalType: null, data: null
  })

  const openModal = (modalType, data) => dispatchModal({ type: 'OPEN', modalType, data })
  const closeModal = () => dispatchModal({ type: 'CLOSE' })

  // ── Acciones de productos ────────────────────────────────────────────────

  const addProduct = (product) => {
    const newId = Math.max(...products.map(p => p.id), 0) + 1
    setProducts(prev => [
      ...prev,
      {
        id: newId,
        brand: '',
        warranty: '1 año',
        rating: 0,
        featured: false,
        image_url: null,
        ...product,
      }
    ])
  }

  const updateProduct = (id, changes) => {
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...changes } : p)))
  }

  const removeProduct = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  // ── Acciones de pedidos ──────────────────────────────────────────────────

  const addOrder = (order) => {
    const prod = products.find(p => p.name === order.product)
    const newOrder = {
      ...order,
      id: `#${1084 + orders.length}`,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'pending',
      statusText: 'Pendiente',
      total: prod ? `$${prod.price_usd.toFixed(2)}` : order.total || '$0',
    }
    setOrders(prev => [newOrder, ...prev])
  }

  // ── Acciones de clientes ─────────────────────────────────────────────────

  const addCustomer = (customer) => {
    const newCustomer = {
      ...customer,
      id: `B2C-${String(customers.length + 1).padStart(3, '0')}`,
      orders: 0,
      spent: '$0',
      status: 'pending',
    }
    setCustomers(prev => [...prev, newCustomer])
  }

  // ────────────────────────────────────────────────────────────────────────

  const value = {
    currentPage, setCurrentPage,
    sidebarOpen, setSidebarOpen,
    products, addProduct, updateProduct, removeProduct,
    orders, addOrder,
    customers, addCustomer,
    invoices,
    modal, openModal, closeModal,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider')
  return context
}
