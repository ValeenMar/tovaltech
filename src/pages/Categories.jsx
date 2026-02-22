// src/pages/Categories.jsx
// Gestión de categorías con soporte de subcategorías (padre/hijo).
// - Crear categorías padre o subcategorías asignadas a un padre
// - Vista en árbol expandible
// - Markup inline editable con barra Aplicar/Cancelar (sin refresh por cambio)
// - Asignación de productos a cualquier nivel

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

// ── Hook: carga categorías ──────────────────────────────────────────────────
function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/categories')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar categorías')
      setCategories(data.categories || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { categories, loading, error, reload: load }
}

// Arma árbol padre/hijo desde la lista plana
function buildTree(categories) {
  const parents  = categories.filter(c => !c.parent_id)
  const children = categories.filter(c => c.parent_id)
  return parents.map(p => ({
    ...p,
    children: children.filter(c => c.parent_id === p.id),
  }))
}

function useEscapeClose(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, onClose])
}

// ── Barra sticky de cambios pendientes ─────────────────────────────────────
function PendingBar({ pendingCount, onApply, onCancel, saving }) {
  if (pendingCount === 0) return null
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between
                    bg-amber-50 border border-amber-300 rounded-xl px-5 py-3 mb-4 shadow-md">
      <div className="flex items-center gap-2.5">
        <span className="text-amber-500 text-lg">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">
            {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} sin guardar
          </p>
          <p className="text-xs text-amber-600">
            Los cambios no se aplicarán hasta que presiones <strong>Aplicar</strong>.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-xl border border-amber-300 text-sm font-medium
                     text-amber-700 bg-white hover:bg-amber-50 disabled:opacity-50 transition-colors">
          Cancelar
        </button>
        <button
          onClick={onApply}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold
                     hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-2">
          {saving
            ? <><span className="animate-spin inline-block">⚙️</span> Guardando...</>
            : <>✅ Aplicar {pendingCount} cambio{pendingCount !== 1 ? 's' : ''}</>}
        </button>
      </div>
    </div>
  )
}

// ── Markup editable inline ──────────────────────────────────────────────────
// pendingValue: valor pendiente que viene del padre (undefined = sin cambio)
// onPendingChange(id, value | undefined): notifica al padre
function InlineMarkupEditor({ cat, globalMarkup, pendingValue, onPendingChange }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState('')
  const inputRef = useRef(null)

  // Valor efectivo a mostrar: pendiente o guardado en DB
  const displayValue = pendingValue !== undefined ? pendingValue : cat.markup_pct
  const hasPending   = pendingValue !== undefined
  const hasCustom    = displayValue !== null && displayValue !== undefined

  // Sincronizar input cuando cambia el display
  useEffect(() => {
    setValue(displayValue != null ? String(displayValue) : '')
  }, [displayValue])

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commit = () => {
    const markup = value.trim() === '' ? null : parseFloat(value)
    if (markup !== null && (!Number.isFinite(markup) || markup < 0 || markup > 500)) {
      setValue(displayValue != null ? String(displayValue) : '')
      setEditing(false)
      return
    }
    if (markup !== cat.markup_pct) {
      onPendingChange(cat.id, markup)
    } else {
      // Volvió al valor guardado → limpiar pending
      onPendingChange(cat.id, undefined)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="number" min="0" max="500" step="0.5"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')  commit()
            if (e.key === 'Escape') { setValue(displayValue != null ? String(displayValue) : ''); setEditing(false) }
          }}
          onBlur={commit}
          className="w-20 px-2 py-1 border border-amber-400 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <span className="text-gray-400 text-sm">%</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setValue(displayValue != null ? String(displayValue) : ''); setEditing(true) }}
      title="Click para editar"
      className={`flex items-center gap-1.5 text-sm rounded-lg px-2.5 py-1 transition-all cursor-pointer
        ${hasPending
          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300 hover:bg-amber-100'
          : hasCustom
            ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
      {hasCustom
        ? <>
            <span className="font-semibold">{displayValue}%</span>
            <span className={`text-[10px] font-medium ${hasPending ? 'text-amber-500' : 'text-purple-400'}`}>
              {hasPending ? '✦ pendiente' : '✦ custom'}
            </span>
          </>
        : <>
            <span className="italic">global ({globalMarkup ?? '—'}%)</span>
            <span className="text-[11px] text-gray-300 ml-1">✏️</span>
          </>}
    </button>
  )
}

// ── Modal crear categoría ──────────────────────────────────────────────────
function CreateModal({ allCategories, onClose, onCreated }) {
  useEscapeClose(onClose)

  const [name,     setName]     = useState('')
  const [markup,   setMarkup]   = useState('')
  const [parentId, setParentId] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const parents = allCategories.filter(c => !c.parent_id)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('El nombre es requerido.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action:     'create',
          name:       name.trim(),
          markup_pct: markup !== '' ? parseFloat(markup) : null,
          parent_id:  parentId !== '' ? parseInt(parentId, 10) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      onCreated(data.category)
    } catch (e) {
      setError(e.message); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-4 text-base">➕ Nueva categoría</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre *</label>
            <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Ej: Monitores"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {parents.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Categoría padre <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <select value={parentId} onChange={e => setParentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Ninguna (categoría principal) —</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Markup % <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="500" step="0.5" value={markup}
                onChange={e => setMarkup(e.target.value)} placeholder="Ej: 25"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-gray-500 font-medium">%</span>
            </div>
          </div>
        </div>
        {parentId !== '' && (
          <p className="mt-3 text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg">
            📂 Se creará como subcategoría de <strong>{parents.find(p => String(p.id) === String(parentId))?.name}</strong>.
          </p>
        )}
        {error && <p className="text-xs text-red-500 mt-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creando...' : parentId !== '' ? 'Crear subcategoría' : 'Crear categoría'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: editar nombre/padre ─────────────────────────────────────────────
function EditModal({ category, allCategories, onClose, onSaved }) {
  useEscapeClose(onClose)

  const [name,     setName]     = useState(category.name)
  const [parentId, setParentId] = useState(category.parent_id ? String(category.parent_id) : '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)

  const parents = allCategories.filter(c => !c.parent_id && c.id !== category.id)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('El nombre es requerido.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action:    'update',
          id:        category.id,
          name:      name.trim(),
          parent_id: parentId !== '' ? parseInt(parentId, 10) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      onSaved()
    } catch (e) {
      setError(e.message); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-4 text-base">✏️ Editar categoría</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {parents.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Categoría padre</label>
              <select value={parentId} onChange={e => setParentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Ninguna (categoría principal) —</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500 mt-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: eliminar categoría ──────────────────────────────────────────────
function DeleteModal({ category, allCategories, onClose, onDeleted }) {
  useEscapeClose(onClose)

  const [reassignTo, setReassignTo] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)
  const others = allCategories.filter(c => c.id !== category.id && !c.parent_id)

  const handleDelete = async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: category.id, reassign_to: reassignTo || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      onDeleted()
    } catch (e) {
      setError(e.message); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-2 text-base">🗑️ Eliminar categoría</h3>
        <p className="text-sm text-gray-600 mb-4">
          ¿Estás seguro de eliminar <strong>"{category.name}"</strong>?
          {category.product_count > 0 && ` Tiene ${category.product_count} productos asociados.`}
        </p>
        {category.product_count > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Reasignar productos a <span className="text-gray-400">(opcional)</span>
            </label>
            <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Sin categoría —</option>
              {others.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        )}
        {error && <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleDelete} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50">
            {saving ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: asignar productos ────────────────────────────────────────────────
function AssignModal({ category, allCategories, onClose }) {
  useEscapeClose(onClose)

  const [search,   setSearch]   = useState('')
  const [products, setProducts] = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(null)
  const debounceRef = useRef(null)

  const loadProducts = useCallback(async (q) => {
    setLoading(true)
    try {
      const url = `/api/categories?mode=products&limit=50&search=${encodeURIComponent(q)}`
      const res  = await fetch(url)
      const data = await res.json()
      setProducts(data.products || [])
      setTotal(data.total || 0)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadProducts('') }, [loadProducts])

  const handleSearch = (v) => {
    setSearch(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadProducts(v), 350)
  }

  const toggle = (id) => setSelected(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const handleAssign = async () => {
    if (!selected.size) return
    setSaving(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'assign', product_ids: [...selected], category_name: category.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setDone(data.updated_count)
      setSelected(new Set())
    } catch (e) {
      alert(e.message)
    } finally { setSaving(false) }
  }

  const fmt = (name) => name?.length > 38 ? name.slice(0, 38) + '…' : name

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-base">📦 Asignar a "{category.name}"</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        {done !== null ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-semibold text-gray-800">{done} productos actualizados</p>
            <button onClick={onClose} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Cerrar</button>
          </div>
        ) : (
          <>
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="🔍 Buscar productos..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm animate-pulse">Cargando...</div>
              ) : products.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Sin resultados</div>
              ) : (
                products.map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                      className="w-4 h-4 rounded accent-blue-600" />
                    {p.image_url
                      ? <img src={p.image_url} className="w-8 h-8 object-contain rounded flex-shrink-0" alt="" />
                      : <div className="w-8 h-8 bg-gray-100 rounded flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700">{fmt(p.name)}</p>
                      <p className="text-[11px] text-gray-400">{p.brand} · stock {p.stock}</p>
                    </div>
                    {p.category && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                        {p.category}
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {selected.size > 0
                  ? <strong className="text-blue-600">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</strong>
                  : `${total} productos`}
              </span>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50">Cancelar</button>
                <button onClick={handleAssign} disabled={saving || !selected.size}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
                  {saving ? 'Asignando...' : `Asignar ${selected.size || ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Fila de subcategoría ──────────────────────────────────────────────────────
function SubcategoryRow({ cat, allCategories, globalMarkup, pendingValue, onPendingChange, onReload }) {
  const [showEdit,   setShowEdit]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showAssign, setShowAssign] = useState(false)

  return (
    <>
      <div className="grid grid-cols-[1fr_60px_210px_auto] items-center
                      px-5 py-2.5 border-b border-gray-50 last:border-0
                      bg-indigo-50/30 hover:bg-indigo-50/60 gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-300 text-sm ml-2">└</span>
          <div>
            <p className="font-medium text-gray-700 text-sm truncate">{cat.name}</p>
            <p className="text-[11px] text-indigo-400 mt-0.5">
              subcategoría · {cat.product_count} {cat.product_count === 1 ? 'producto' : 'productos'}
            </p>
          </div>
        </div>
        <div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
            ${cat.product_count > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
            {cat.product_count}
          </span>
        </div>
        <InlineMarkupEditor
          cat={cat}
          globalMarkup={globalMarkup}
          pendingValue={pendingValue}
          onPendingChange={onPendingChange}
        />
        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
          <button onClick={() => setShowAssign(true)}
            title="Mover productos a esta subcategoría"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700
                       hover:bg-green-100 border border-green-200 whitespace-nowrap">
            📦 Mover productos
          </button>
          <button onClick={() => setShowEdit(true)}
            title="Editar nombre o categoría padre"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50
                       hover:bg-blue-100 border border-blue-200 whitespace-nowrap">✏️ Editar</button>
          <button onClick={() => setShowDelete(true)}
            title="Eliminar esta subcategoría"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50
                       hover:bg-red-100 border border-red-200 whitespace-nowrap">🗑️ Eliminar</button>
        </div>
      </div>

      {showEdit   && <EditModal   category={cat} allCategories={allCategories} onClose={() => setShowEdit(false)}
                                  onSaved={() => { setShowEdit(false); onReload() }} />}
      {showDelete && <DeleteModal category={cat} allCategories={allCategories} onClose={() => setShowDelete(false)}
                                  onDeleted={() => { setShowDelete(false); onReload() }} />}
      {showAssign && <AssignModal category={cat} allCategories={allCategories}
                                  onClose={() => { setShowAssign(false); onReload() }} />}
    </>
  )
}

// ── Fila de categoría padre ───────────────────────────────────────────────────
function CategoryRow({ cat, allCategories, globalMarkup, pendingChanges, onPendingChange, onReload, onViewProducts }) {
  const [showEdit,   setShowEdit]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [expanded,   setExpanded]   = useState(true)

  const hasChildren = cat.children?.length > 0

  return (
    <>
      <div className="grid grid-cols-[1fr_60px_210px_auto] items-center
                      px-5 py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 gap-4">
        <div className="min-w-0 flex items-center gap-2">
          {hasChildren ? (
            <button onClick={() => setExpanded(e => !e)}
              className="text-gray-400 hover:text-gray-600 text-sm font-bold w-4 flex-shrink-0">
              {expanded ? '▾' : '▸'}
            </button>
          ) : <span className="w-4 flex-shrink-0" />}
          <div>
            <p className="font-semibold text-gray-800 text-sm truncate">{cat.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {cat.product_count} {cat.product_count === 1 ? 'producto' : 'productos'}
              {hasChildren && <span className="ml-1.5 text-indigo-400">· {cat.children.length} subcategoría{cat.children.length !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>
        <div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
            ${cat.product_count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
            {cat.product_count}
          </span>
        </div>
        <InlineMarkupEditor
          cat={cat}
          globalMarkup={globalMarkup}
          pendingValue={pendingChanges[cat.id]}
          onPendingChange={onPendingChange}
        />
        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
          {cat.product_count > 0 && (
            <button onClick={() => onViewProducts(cat.name)}
              title="Abrir catálogo filtrado por esta categoría"
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700
                         hover:bg-indigo-100 border border-indigo-200 whitespace-nowrap">
              🔍 Ver productos
            </button>
          )}
          <button onClick={() => setShowAssign(true)}
            title="Mover productos a esta categoría"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700
                       hover:bg-green-100 border border-green-200 whitespace-nowrap">
            📦 Mover productos
          </button>
          <button onClick={() => setShowEdit(true)}
            title="Editar nombre o categoría padre"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50
                       hover:bg-blue-100 border border-blue-200 whitespace-nowrap">✏️ Editar</button>
          <button onClick={() => setShowDelete(true)}
            title="Eliminar esta categoría"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50
                       hover:bg-red-100 border border-red-200 whitespace-nowrap">🗑️ Eliminar</button>
        </div>
      </div>

      {hasChildren && expanded && cat.children.map(child => (
        <SubcategoryRow
          key={child.id}
          cat={child}
          allCategories={allCategories}
          globalMarkup={globalMarkup}
          pendingValue={pendingChanges[child.id]}
          onPendingChange={onPendingChange}
          onReload={onReload}
        />
      ))}

      {showEdit   && <EditModal   category={cat} allCategories={allCategories} onClose={() => setShowEdit(false)}
                                  onSaved={() => { setShowEdit(false); onReload() }} />}
      {showDelete && <DeleteModal category={cat} allCategories={allCategories} onClose={() => setShowDelete(false)}
                                  onDeleted={() => { setShowDelete(false); onReload() }} />}
      {showAssign && <AssignModal category={cat} allCategories={allCategories}
                                  onClose={() => { setShowAssign(false); onReload() }} />}
    </>
  )
}

// ── Panel: markup global de categorías ────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full
                  border-2 border-transparent transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-violet-500
                  ${checked ? 'bg-violet-500' : 'bg-gray-200'}`}>
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full
                        bg-white shadow transition duration-200
                        ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

const SCOPES = [
  {
    id:    'categories',
    label: 'Todas las categorías',
    desc:  'Cambia el markup de todas las categorías al valor indicado.',
    needsValue: true,
    warn:  false,
  },
  {
    id:    'products_default',
    label: 'Productos sin markup propio (heredan global)',
    desc:  'Asigna el valor a los productos que tienen markup NULL — los que actualmente heredan el global.',
    needsValue: true,
    warn:  false,
  },
  {
    id:    'products_all',
    label: 'Todos los productos (sobreescribir todo)',
    desc:  'Asigna el valor a absolutamente todos los productos, tengan markup propio o no.',
    needsValue: true,
    warn:  true,
  },
  {
    id:    'products_reset',
    label: 'Resetear markup de todos los productos',
    desc:  'Borra el markup individual de todos los productos para que hereden el de su categoría.',
    needsValue: false,
    warn:  true,
  },
]

function BulkMarkupPanel({ onDone }) {
  const [scope,       setScope]       = useState('categories')
  const [value,       setValue]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [result,      setResult]      = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const currentScope = SCOPES.find(s => s.id === scope)
  const isValid = !currentScope.needsValue ||
    (value !== '' && Number.isFinite(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 500)

  const handleApply = async () => {
    setShowConfirm(false)
    setSaving(true)
    setResult(null)
    try {
      const res  = await fetch('/api/categories', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action:     'bulk_markup',
          markup_pct: currentScope.needsValue ? parseFloat(value) : null,
          scope,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setResult({ ok: true, data })
      setValue('')
      onDone()
    } catch (e) {
      setResult({ ok: false, error: e.message })
    } finally {
      setSaving(false)
    }
  }

  useEscapeClose(() => setShowConfirm(false), showConfirm)

  return (
    <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl px-5 py-4 mb-5">
      <p className="text-sm font-bold text-violet-800 mb-1">🎛️ Markup global de categorías y productos</p>
      <p className="text-xs text-violet-600 mb-4">
        Modificá en masa el markup de categorías y/o productos sin tocarlos uno por uno.
      </p>

      {/* Selector de scope como radio buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {SCOPES.map(s => (
          <label key={s.id}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
              ${scope === s.id
                ? 'border-violet-400 bg-violet-100'
                : 'border-gray-200 bg-white hover:border-violet-200'}`}>
            <input type="radio" name="bulk_scope" value={s.id} checked={scope === s.id}
              onChange={() => { setScope(s.id); setResult(null) }}
              className="mt-0.5 accent-violet-600 flex-shrink-0" />
            <div>
              <p className={`text-xs font-semibold ${scope === s.id ? 'text-violet-800' : 'text-gray-700'}`}>
                {s.warn && '⚠️ '}{s.label}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">{s.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Input valor + botón */}
      <div className="flex flex-wrap items-end gap-3">
        {currentScope.needsValue && (
          <div>
            <label className="block text-xs font-semibold text-violet-700 mb-1">Markup a aplicar</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min="0" max="500" step="0.5"
                value={value}
                onChange={e => { setValue(e.target.value); setResult(null) }}
                placeholder="Ej: 40"
                className="w-24 px-3 py-2 border border-violet-300 rounded-lg text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <span className="text-violet-600 font-semibold text-sm">%</span>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!isValid || saving}
          className="px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold
                     hover:bg-violet-700 disabled:opacity-40 transition-colors flex items-center gap-2">
          {saving
            ? <><span className="animate-spin inline-block">⚙️</span> Aplicando...</>
            : '🎛️ Aplicar'}
        </button>
      </div>

      {/* Resultado */}
      {result?.ok && (
        <div className="mt-3 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg">
          {result.data.scope === 'categories' && `✅ ${result.data.updated_cats} categorías actualizadas a ${result.data.markup_pct}%.`}
          {result.data.scope === 'products_default' && `✅ ${result.data.updated_products} productos sin markup propio actualizados a ${result.data.markup_pct}%.`}
          {result.data.scope === 'products_all' && `✅ ${result.data.updated_products} productos actualizados a ${result.data.markup_pct}%.`}
          {result.data.scope === 'products_reset' && `✅ Markup individual reseteado en ${result.data.updated_products} productos. Ahora heredan de su categoría.`}
        </div>
      )}
      {result?.ok === false && (
        <div className="mt-3 text-xs bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg">
          ⚠️ {result.error}
        </div>
      )}

      {/* Modal confirmación */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
             onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
               onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-3 text-base">🎛️ Confirmar cambio masivo</h3>
            <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5 text-xs text-violet-700 mb-3">
              <strong>{currentScope.label}</strong>
              {currentScope.needsValue && <> → <strong>{value}%</strong></>}
            </div>
            <p className="text-xs text-gray-500 mb-5">
              {currentScope.warn
                ? '⚠️ Esta operación afecta a muchos registros y no se puede deshacer desde la app.'
                : 'Esta operación no se puede deshacer desde la app.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleApply}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// ── Componente principal ──────────────────────────────────────────────────────
export default function Categories() {
  const { categories, loading, error, reload } = useCategories()
  const { setAdminCategoryFilter } = useApp()
  const navigate = useNavigate()
  const [showCreate,     setShowCreate]     = useState(false)
  const [search,         setSearch]         = useState('')
  const [globalMarkup,   setGlobalMarkup]   = useState(null)
  // pendingChanges: { [categoryId]: newMarkupValue | undefined }
  const [pendingChanges, setPendingChanges] = useState({})
  const [applyingSave,   setApplyingSave]   = useState(false)
  const [saveResult,     setSaveResult]     = useState(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => setGlobalMarkup(parseFloat(d?.global_markup_pct?.value ?? 0)))
      .catch(() => {})
  }, [])

  const handlePendingChange = (id, value) => {
    setPendingChanges(prev => {
      const next = { ...prev }
      if (value === undefined) {
        delete next[id]
      } else {
        next[id] = value
      }
      return next
    })
    setSaveResult(null)
  }

  const pendingCount = Object.keys(pendingChanges).length

  const handleCancel = () => {
    setPendingChanges({})
    setSaveResult(null)
  }

  const handleApply = async () => {
    setApplyingSave(true)
    setSaveResult(null)
    const entries = Object.entries(pendingChanges)
    const errors  = []

    await Promise.all(entries.map(async ([id, markup_pct]) => {
      try {
        const res = await fetch('/api/categories', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'update', id: parseInt(id, 10), markup_pct }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error')
      } catch (e) {
        errors.push({ id, error: e.message })
      }
    }))

    setApplyingSave(false)

    if (errors.length === 0) {
      setPendingChanges({})
      setSaveResult({ ok: true, count: entries.length })
      setTimeout(() => setSaveResult(null), 2500)
      reload()
    } else {
      setSaveResult({ ok: false, errors })
    }
  }

  const tree = buildTree(categories)

  const filtered = !search ? tree : tree.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.children?.some(ch => ch.name.toLowerCase().includes(search.toLowerCase()))
  )

  const totalParents  = categories.filter(c => !c.parent_id).length
  const totalChildren = categories.filter(c =>  c.parent_id).length
  const totalProducts = categories.reduce((s, c) => s + (c.product_count || 0), 0)
  const withMarkup    = categories.filter(c => c.markup_pct !== null).length

  const handleViewProducts = (categoryName) => {
    setAdminCategoryFilter(categoryName)
    navigate('/admin/products')
  }

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-lg text-gray-800">
            🗂️ Categorías
            <span className="ml-2 text-sm font-normal text-gray-400">
              {loading ? 'cargando...' : `${totalParents} categorías · ${totalChildren} subcategorías`}
            </span>
          </h3>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">
              {totalProducts} productos asignados ·{' '}
              {withMarkup} con markup personalizado ·{' '}
              Markup global: <strong>{globalMarkup ?? '—'}%</strong>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm
                     font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          ➕ Nueva categoría
        </button>
      </div>

      {/* Guía rápida */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700">
        <p className="font-semibold mb-1">💡 Cómo usar esta sección (rápido)</p>
        <p>
          1) Tocá el <strong>markup</strong> de una fila para editarlo. 2) Usá <strong>Aplicar</strong> para guardar cambios pendientes.
          3) <strong>Ver productos</strong> abre el catálogo filtrado. 4) <strong>Mover productos</strong> reasigna ítems a la categoría elegida.
        </p>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-5
                      flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-indigo-700">
        <span className="font-semibold">📐 Prioridad de markup:</span>
        <span>1. Producto (★)</span>
        <span>2. Categoría/Subcategoría (★)</span>
        <span>3. Global</span>
        <span className="ml-auto text-indigo-500 font-medium">Las subcategorías también aparecen como filtros en tienda</span>
      </div>

      {/* Panel markup global */}
      <BulkMarkupPanel onDone={reload} />

      {/* Búsqueda */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Filtrar categorías..."
          className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Barra sticky de cambios pendientes */}
      <PendingBar
        pendingCount={pendingCount}
        onApply={handleApply}
        onCancel={handleCancel}
        saving={applyingSave}
      />

      {/* Feedback post-guardado */}
      {saveResult?.ok && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl
                        px-5 py-3 mb-4 text-sm text-green-700 font-medium">
          ✅ {saveResult.count} cambio{saveResult.count !== 1 ? 's' : ''} guardado{saveResult.count !== 1 ? 's' : ''} correctamente.
        </div>
      )}
      {saveResult?.ok === false && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-4 text-sm text-red-700">
          ⚠️ Algunos cambios no pudieron guardarse:
          <ul className="mt-1 text-xs list-disc ml-4">
            {saveResult.errors.map((e, i) => <li key={i}>ID {e.id}: {e.error}</li>)}
          </ul>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <div className="animate-spin text-3xl mr-3">⚙️</div> Cargando...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <strong>Error al cargar categorías.</strong>
            <p className="text-xs mt-0.5 text-red-500">{error}</p>
          </div>
          <button onClick={reload} className="ml-auto px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-semibold">Reintentar</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_60px_210px_auto] px-5 py-2.5
                          bg-gray-50 border-b border-gray-200
                          text-[11px] font-semibold text-gray-400 uppercase tracking-wider gap-4">
            <span>Categoría / Subcategoría</span>
            <span>Productos</span>
            <span>Markup (tocá para editar)</span>
            <span>Acciones</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              {search ? 'No hay categorías que coincidan' : 'No hay categorías creadas'}
              {!search && (
                <button onClick={() => setShowCreate(true)}
                  className="block mx-auto mt-3 text-blue-600 text-sm hover:underline">
                  ➕ Crear primera categoría
                </button>
              )}
            </div>
          ) : (
            filtered.map(cat => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                allCategories={categories}
                globalMarkup={globalMarkup}
                pendingChanges={pendingChanges}
                onPendingChange={handlePendingChange}
                onReload={reload}
                onViewProducts={handleViewProducts}
              />
            ))
          )}
        </div>
      )}

      {showCreate && (
        <CreateModal
          allCategories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); reload() }}
        />
      )}
    </>
  )
}
