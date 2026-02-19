import { createContext, useContext, useState, useReducer } from 'react'
import { orders as initOrders, products as initProducts, customers as initCustomers, invoices as initInvoices } from '../data/mockData'

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
  const [products, setProducts] = useState(initProducts)
  const [customers, setCustomers] = useState(initCustomers)
  const [invoices] = useState(initInvoices)
  const [modal, dispatchModal] = useReducer(modalReducer, {
    isOpen: false, modalType: null, data: null
  })

  const openModal = (modalType, data) => dispatchModal({ type: 'OPEN', modalType, data })
  const closeModal = () => dispatchModal({ type: 'CLOSE' })

  const addOrder = (order) => {
    const newOrder = {
      ...order,
      id: `#${1084 + orders.length}`,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'pending',
      statusText: 'Pendiente'
    }
    setOrders(prev => [newOrder, ...prev])
  }

  const addProduct = (product) => {
    setProducts(prev => [...prev, product])
  }

  const addCustomer = (customer) => {
    const newCustomer = {
      ...customer,
      id: `B2C-${String(customers.length + 1).padStart(3, '0')}`,
      orders: 0,
      spent: '$0',
      status: 'pending'
    }
    setCustomers(prev => [...prev, newCustomer])
  }

  const value = {
    currentPage, setCurrentPage,
    sidebarOpen, setSidebarOpen,
    orders, addOrder,
    products, addProduct,
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