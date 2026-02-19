import { useApp } from '../../context/AppContext'
import { useState } from 'react'

export default function Modal() {
  const { modal, closeModal, addOrder, addProduct, addCustomer, products, customers } = useApp()

  if (!modal.isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeModal}>
      <div className="bg-white rounded-2xl p-7 w-[90%] max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {modal.modalType === 'order' && <OrderForm />}
        {modal.modalType === 'product' && <ProductForm />}
        {modal.modalType === 'customer' && <CustomerForm />}
      </div>
    </div>
  )
}

function OrderForm() {
  const { closeModal, addOrder, products, customers } = useApp()
  const [form, setForm] = useState({ customer: customers[0]?.name || '', product: products[0]?.name || '', quantity: 1 })

  const handleSubmit = () => {
    const prod = products.find(p => p.name === form.product)
    addOrder({ customer: form.customer, product: form.product, total: prod?.price || '$0' })
    closeModal()
  }

  return (
    <>
      <h2 className="text-xl font-bold mb-5">📦 Nuevo Pedido</h2>
      <Label text="Cliente">
        <select value={form.customer} onChange={e => setForm({...form, customer: e.target.value})} className="input-field">
          {customers.map(c => <option key={c.id}>{c.name}</option>)}
        </select>
      </Label>
      <Label text="Producto">
        <select value={form.product} onChange={e => setForm({...form, product: e.target.value})} className="input-field">
          {products.map(p => <option key={p.name}>{p.name} — {p.price}</option>)}
        </select>
      </Label>
      <Label text="Cantidad">
        <input type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="input-field" />
      </Label>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-azure-500 text-white text-sm font-semibold hover:bg-azure-600">Crear Pedido</button>
      </div>
    </>
  )
}

function ProductForm() {
  const { closeModal, addProduct } = useApp()
  const [form, setForm] = useState({ name: '', emoji: '📦', price: '', stock: 10, category: 'Accesorios' })

  const handleSubmit = () => {
    addProduct({ ...form, price: `$${form.price}`, stock: Number(form.stock) })
    closeModal()
  }

  return (
    <>
      <h2 className="text-xl font-bold mb-5">🏷️ Nuevo Producto</h2>
      <Label text="Nombre"><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="Nombre del producto" /></Label>
      <Label text="Emoji"><input type="text" value={form.emoji} onChange={e => setForm({...form, emoji: e.target.value})} className="input-field" /></Label>
      <Label text="Precio (USD)"><input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="input-field" placeholder="0.00" /></Label>
      <Label text="Stock"><input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="input-field" /></Label>
      <Label text="Categoría">
        <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input-field">
          {['Computadoras','Pantallas','Periféricos','Audio','Video','Almacenamiento','Tablets','Accesorios'].map(c => <option key={c}>{c}</option>)}
        </select>
      </Label>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-azure-500 text-white text-sm font-semibold hover:bg-azure-600">Guardar</button>
      </div>
    </>
  )
}

function CustomerForm() {
  const { closeModal, addCustomer } = useApp()
  const [form, setForm] = useState({ name: '', email: '' })

  const handleSubmit = () => {
    addCustomer(form)
    closeModal()
  }

  return (
    <>
      <h2 className="text-xl font-bold mb-5">👤 Invitar Cliente</h2>
      <Label text="Nombre"><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="Nombre completo" /></Label>
      <Label text="Email"><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" placeholder="correo@ejemplo.com" /></Label>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-azure-500 text-white text-sm font-semibold hover:bg-azure-600">Enviar Invitación</button>
      </div>
    </>
  )
}

function Label({ text, children }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-500 mb-1.5">{text}</label>
      {children}
    </div>
  )
}