import { useApp } from '../../context/AppContext'
import { useState } from 'react'
import { CATEGORIES } from '../../data/products'

export default function Modal() {
  const { modal, closeModal } = useApp()
  if (!modal.isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl p-7 w-[90%] max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {modal.modalType === 'order'    && <OrderForm />}
        {modal.modalType === 'product'  && <ProductForm />}
        {modal.modalType === 'customer' && <CustomerForm />}
      </div>
    </div>
  )
}

// ── Formulario: Pedido ────────────────────────────────────────────────────────

function OrderForm() {
  const { closeModal, addOrder, products, customers } = useApp()
  const [form, setForm] = useState({
    customer: customers[0]?.name ?? '',
    product:  products[0]?.name  ?? '',
    quantity: 1,
  })

  const handleSubmit = () => {
    if (!form.customer || !form.product) return
    addOrder({ customer: form.customer, product: form.product, quantity: Number(form.quantity) })
    closeModal()
  }

  return (
    <>
      <h2 className="text-xl font-bold mb-5">📦 Nuevo Pedido</h2>
      <Label text="Cliente">
        <select value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} className="input-field">
          {customers.map(c => <option key={c.id}>{c.name}</option>)}
        </select>
      </Label>
      <Label text="Producto">
        <select value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} className="input-field">
          {products.map(p => (
            <option key={p.id}>{p.name} — USD {p.price_usd?.toFixed(2)}</option>
          ))}
        </select>
      </Label>
      <Label text="Cantidad">
        <input type="number" min="1" value={form.quantity}
          onChange={e => setForm({ ...form, quantity: e.target.value })} className="input-field" />
      </Label>
      <Actions onCancel={closeModal} onConfirm={handleSubmit} confirmLabel="Crear Pedido" />
    </>
  )
}

// ── Formulario: Producto ──────────────────────────────────────────────────────

const CATEGORY_OPTIONS = CATEGORIES.filter(c => c !== 'Todos')

function ProductForm() {
  const { closeModal, addProduct } = useApp()
  const [form, setForm] = useState({
    name:      '',
    emoji:     '📦',
    brand:     '',
    category:  'Accesorios',
    price_usd: '',
    price_ars: '',
    stock:     10,
    warranty:  '1 año',
    featured:  false,
    description: '',
  })

  // Auto-calcula ARS cuando cambia USD (tipo de cambio referencial)
  const handleUsdChange = (val) => {
    const usd = parseFloat(val) || 0
    setForm(f => ({
      ...f,
      price_usd: val,
      price_ars: usd > 0 ? String(Math.round(usd * 1000)) : f.price_ars,
    }))
  }

  const handleSubmit = () => {
    if (!form.name || !form.price_usd) return
    addProduct({
      ...form,
      price_usd: parseFloat(form.price_usd),
      price_ars: parseFloat(form.price_ars) || Math.round(parseFloat(form.price_usd) * 1000),
      stock:     Number(form.stock),
    })
    closeModal()
  }

  return (
    <>
      <h2 className="text-xl font-bold mb-5">🏷️ Nuevo Producto</h2>

      <div className="grid grid-cols-2 gap-3">
        <Label text="Nombre" className="col-span-2">
          <input type="text" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="input-field" placeholder="Nombre del producto" />
        </Label>
        <Label text="Emoji (icono)">
          <input type="text" value={form.emoji}
            onChange={e => setForm({ ...form, emoji: e.target.value })}
            className="input-field text-2xl" />
        </Label>
        <Label text="Marca">
          <input type="text" value={form.brand}
            onChange={e => setForm({ ...form, brand: e.target.value })}
            className="input-field" placeholder="Ej: Samsung" />
        </Label>
        <Label text="Precio USD">
          <input type="number" min="0" step="0.01" value={form.price_usd}
            onChange={e => handleUsdChange(e.target.value)}
            className="input-field" placeholder="0.00" />
        </Label>
        <Label text="Precio ARS">
          <input type="number" min="0" value={form.price_ars}
            onChange={e => setForm({ ...form, price_ars: e.target.value })}
            className="input-field" placeholder="Auto-calculado" />
        </Label>
        <Label text="Stock">
          <input type="number" min="0" value={form.stock}
            onChange={e => setForm({ ...form, stock: e.target.value })} className="input-field" />
        </Label>
        <Label text="Garantía">
          <input type="text" value={form.warranty}
            onChange={e => setForm({ ...form, warranty: e.target.value })}
            className="input-field" placeholder="1 año" />
        </Label>
        <Label text="Categoría" className="col-span-2">
          <select value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })} className="input-field">
            {CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
          </select>
        </Label>
        <Label text="Descripción" className="col-span-2">
          <textarea value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="input-field resize-none" rows={2} placeholder="Descripción breve del producto" />
        </Label>
        <label className="col-span-2 flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.featured}
            onChange={e => setForm({ ...form, featured: e.target.checked })}
            className="w-4 h-4 accent-azure-500" />
          <span className="text-sm font-medium text-gray-700">⭐ Mostrar como producto destacado en la tienda</span>
        </label>
      </div>

      <Actions onCancel={closeModal} onConfirm={handleSubmit} confirmLabel="Guardar Producto" />
    </>
  )
}

// ── Formulario: Cliente ───────────────────────────────────────────────────────

function CustomerForm() {
  const { closeModal, addCustomer } = useApp()
  const [form, setForm] = useState({ name: '', email: '' })

  const handleSubmit = () => {
    if (!form.name || !form.email) return
    addCustomer(form)
    closeModal()
  }

  return (
    <>
      <h2 className="text-xl font-bold mb-5">👤 Invitar Cliente</h2>
      <Label text="Nombre">
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="input-field" placeholder="Nombre completo" />
      </Label>
      <Label text="Email">
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
          className="input-field" placeholder="correo@ejemplo.com" />
      </Label>
      <Actions onCancel={closeModal} onConfirm={handleSubmit} confirmLabel="Enviar Invitación" />
    </>
  )
}

// ── Helpers UI ────────────────────────────────────────────────────────────────

function Label({ text, children, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      <label className="block text-sm font-semibold text-gray-500 mb-1.5">{text}</label>
      {children}
    </div>
  )
}

function Actions({ onCancel, onConfirm, confirmLabel }) {
  return (
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onCancel}
        className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50">
        Cancelar
      </button>
      <button onClick={onConfirm}
        className="px-4 py-2 rounded-lg bg-azure-500 text-white text-sm font-semibold hover:bg-azure-600">
        {confirmLabel}
      </button>
    </div>
  )
}
