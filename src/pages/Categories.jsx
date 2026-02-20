// src/pages/Categories.jsx
// Gestión de categorías: crear, editar nombre/markup, eliminar y asignar productos.

import { useState, useEffect, useCallback, useRef } from 'react'

// ── Formatters ──────────────────────────────────────────────────────────────
const fmtARS = (n) => n != null
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  : '—'

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

// ── Modal: crear categoría ──────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const [name,      setName]      = useState('')
  const [markup,    setMarkup]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('El nombre es requerido.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action:     'create',
          name:       name.trim(),
          markup_pct: markup !== '' ? parseFloat(markup) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      onCreated(data.category)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
         onClick={() => onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-4 text-base">➕ Nueva categoría</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre *</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Ej: Monitores"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Markup % <span className="text-gray-400 font-normal">(opcional — si no, usa el global)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="500" step="0.5"
                value={markup}
                onChange={e => setMarkup(e.target.value)}
                placeholder="Ej: 25"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500 font-medium">%</span>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold
                       hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creando...' : 'Crear categoría'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: editar categoría ─────────────────────────────────────────────────
function EditModal({ category, onClose, onSaved }) {
  const [name,   setName]   = useState(category.name)
  const [markup, setMarkup] = useState(
    category.markup_pct !== null ? String(category.markup_pct) : ''
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es requerido.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action:     'update',
          id:         category.id,
          name:       name.trim(),
          markup_pct: markup !== '' ? parseFloat(markup) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-1 text-base">✏️ Editar categoría</h3>
        <p className="text-xs text-gray-400 mb-4">
          Cambiar el nombre actualiza automáticamente los productos asignados.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Markup % <span className="text-gray-400 font-normal">(vacío = usar global)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="500" step="0.5"
                value={markup}
                onChange={e => setMarkup(e.target.value)}
                placeholder="Markup global"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500 font-medium">%</span>
            </div>
            {markup !== '' && (
              <button onClick={() => setMarkup('')}
                className="text-xs text-gray-400 hover:text-red-500 mt-1">
                × Quitar markup personalizado
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold
                       hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: eliminar categoría ───────────────────────────────────────────────
function DeleteModal({ category, allCategories, onClose, onDeleted }) {
  const [reassignTo, setReassignTo] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)

  const otherCats = allCategories.filter(c => c.id !== category.id)

  const handleDelete = async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action:      'delete',
          id:          category.id,
          reassign_to: reassignTo || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      onDeleted()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🗑️</span>
          <div>
            <h3 className="font-bold text-gray-800 text-base">Eliminar categoría</h3>
            <p className="text-sm text-gray-500">«{category.name}»</p>
          </div>
        </div>

        {category.product_count > 0 ? (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-orange-700 font-medium">
              ⚠️ Esta categoría tiene <strong>{category.product_count} productos</strong> asignados.
            </p>
            <p className="text-xs text-orange-500 mt-1">
              Podés reasignarlos a otra categoría, o dejarlos con el texto de categoría libre.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">
            Esta categoría no tiene productos asignados. Se puede eliminar sin impacto.
          </p>
        )}

        {category.product_count > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Reasignar productos a:
            </label>
            <select
              value={reassignTo}
              onChange={e => setReassignTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Dejar sin reasignar —</option>
              {otherCats.map(c => (
                <option key={c.id} value={c.name}>{c.name} ({c.product_count})</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold
                       hover:bg-red-600 disabled:opacity-50">
            {saving ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: asignar productos a una categoría ────────────────────────────────
function AssignModal({ category, allCategories, onClose }) {
  const [search,    setSearch]    = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [products,  setProducts]  = useState([])
  const [total,     setTotal]     = useState(0)
  const [selected,  setSelected]  = useState(new Set())
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [feedback,  setFeedback]  = useState(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Cargar productos cuando cambian filtros
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ mode: 'products', limit: '80' })
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (filterCat)       params.set('category', filterCat)
        const res  = await fetch(`/api/categories?${params}`)
        const data = await res.json()
        setProducts(data.products || [])
        setTotal(data.total || 0)
      } catch { /* silencio */ }
      finally { setLoading(false) }
    }
    load()
  }, [debouncedSearch, filterCat])

  const toggle = (id) => setSelected(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const selectAll = () => setSelected(new Set(products.map(p => p.id)))
  const clearAll  = () => setSelected(new Set())

  // Seleccionar los que ya están en esta categoría
  const selectCurrentCategory = () => {
    setSelected(new Set(products.filter(p => p.category === category.name).map(p => p.id)))
  }

  const handleAssign = async () => {
    if (!selected.size) return
    setSaving(true); setFeedback(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action:        'assign',
          product_ids:   [...selected],
          category_name: category.name,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setFeedback({ type: 'ok', msg: `✅ ${data.updated_count} productos asignados a "${category.name}"` })
      setSelected(new Set())
      // Refrescar lista
      const params = new URLSearchParams({ mode: 'products', limit: '80' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterCat)       params.set('category', filterCat)
      const r = await fetch(`/api/categories?${params}`)
      const d = await r.json()
      setProducts(d.products || [])
    } catch (e) {
      setFeedback({ type: 'err', msg: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-800 text-base">
              📦 Asignar productos a «{category.name}»
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Seleccioná los productos y hacé clic en "Asignar".
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-xl leading-none mt-0.5">✕</button>
        </div>

        {/* Filtros */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar por nombre, marca, SKU..."
            className="flex-1 min-w-[200px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
          >
            <option value="">Todas las categorías</option>
            <option value="__none__">Sin categoría</option>
            {allCategories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Acciones masivas */}
        <div className="px-6 py-2 flex items-center gap-3 text-xs border-b border-gray-100 bg-gray-50">
          <span className="text-gray-500">
            {loading ? 'Cargando...' : `${total} productos · ${selected.size} seleccionados`}
          </span>
          <button onClick={selectAll}              className="text-blue-600 hover:underline">Seleccionar todo</button>
          <button onClick={clearAll}               className="text-gray-400 hover:underline">Limpiar</button>
          <button onClick={selectCurrentCategory}  className="text-green-600 hover:underline">
            Seleccionar los de esta categoría
          </button>
        </div>

        {/* Lista de productos */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              Cargando productos...
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              No se encontraron productos
            </div>
          ) : (
            <div className="space-y-1">
              {products.map(p => {
                const isSelected = selected.has(p.id)
                const isCurrent  = p.category === category.name
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors
                      ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(p.id)}
                      className="accent-blue-600 w-4 h-4 shrink-0"
                    />
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-9 h-9 object-contain rounded bg-gray-50 shrink-0"
                             onError={e => e.target.style.display='none'} />
                      : <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center text-lg shrink-0">📦</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {p.brand && `${p.brand} · `}{p.sku}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCurrent && (
                        <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                          Actual
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                        ${p.stock > 10 ? 'bg-green-100 text-green-700'
                          : p.stock > 0 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-600'}`}>
                        {p.stock} uds
                      </span>
                      {p.category && !isCurrent && (
                        <span className="text-[10px] text-gray-400 max-w-[80px] truncate">{p.category}</span>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
          {feedback ? (
            <p className={`text-sm font-medium ${feedback.type === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
              {feedback.msg}
            </p>
          ) : (
            <p className="text-xs text-gray-400">
              {selected.size > 0
                ? `${selected.size} productos se moverán a "${category.name}"`
                : 'Seleccioná productos para asignar'}
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">
              Cerrar
            </button>
            <button
              onClick={handleAssign}
              disabled={saving || selected.size === 0}
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold
                         hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Asignando...' : `Asignar ${selected.size > 0 ? `(${selected.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Fila de categoría ────────────────────────────────────────────────────────
function CategoryRow({ cat, allCategories, globalMarkup, onReload }) {
  const [showEdit,   setShowEdit]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showAssign, setShowAssign] = useState(false)

  const hasCustomMarkup = cat.markup_pct !== null
  const effectiveMarkup = hasCustomMarkup ? cat.markup_pct : globalMarkup

  return (
    <>
      <div className="grid grid-cols-[1fr_80px_140px_80px_auto] items-center
                      px-5 py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 gap-3">
        {/* Nombre */}
        <div>
          <p className="font-semibold text-gray-800 text-sm">{cat.name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {cat.product_count} {cat.product_count === 1 ? 'producto' : 'productos'}
          </p>
        </div>

        {/* Productos (badge) */}
        <div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
            ${cat.product_count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
            {cat.product_count}
          </span>
        </div>

        {/* Markup */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
            ${hasCustomMarkup
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-500'}`}>
            {effectiveMarkup != null ? `${effectiveMarkup}%` : '—'}
            {hasCustomMarkup && <span className="ml-1 text-[9px]">★</span>}
          </span>
          {!hasCustomMarkup && (
            <span className="text-[10px] text-gray-400">(global)</span>
          )}
        </div>

        {/* Última actualización */}
        <div className="text-[11px] text-gray-400">
          {cat.updated_at
            ? new Date(cat.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
            : '—'}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAssign(true)}
            title="Asignar productos"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700
                       hover:bg-green-100 border border-green-200 whitespace-nowrap">
            📦 Asignar
          </button>
          <button
            onClick={() => setShowEdit(true)}
            title="Editar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50
                       border border-transparent hover:border-blue-200 text-sm">
            ✏️
          </button>
          <button
            onClick={() => setShowDelete(true)}
            title="Eliminar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                       border border-transparent hover:border-red-200 text-sm">
            🗑️
          </button>
        </div>
      </div>

      {showEdit && (
        <EditModal
          category={cat}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onReload() }}
        />
      )}

      {showDelete && (
        <DeleteModal
          category={cat}
          allCategories={allCategories}
          onClose={() => setShowDelete(false)}
          onDeleted={() => { setShowDelete(false); onReload() }}
        />
      )}

      {showAssign && (
        <AssignModal
          category={cat}
          allCategories={allCategories}
          onClose={() => { setShowAssign(false); onReload() }}
        />
      )}
    </>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Categories() {
  const { categories, loading, error, reload } = useCategories()
  const [showCreate,  setShowCreate]  = useState(false)
  const [search,      setSearch]      = useState('')
  const [globalMarkup, setGlobalMarkup] = useState(null)

  // Cargar markup global para mostrarlo como referencia
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => setGlobalMarkup(parseFloat(d?.global_markup_pct?.value ?? 0)))
      .catch(() => {})
  }, [])

  const filtered = categories.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalProducts = categories.reduce((s, c) => s + (c.product_count || 0), 0)
  const withMarkup    = categories.filter(c => c.markup_pct !== null).length

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-lg text-gray-800">
            🗂️ Categorías
            <span className="ml-2 text-sm font-normal text-gray-400">
              {loading ? 'cargando...' : `${categories.length} categorías`}
            </span>
          </h3>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">
              {totalProducts} productos asignados ·{' '}
              {withMarkup} categorías con markup personalizado ·{' '}
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

      {/* ── Info markup jerarquía ──────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5
                      flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-blue-700">
        <span className="font-semibold">💹 Jerarquía de markup:</span>
        <span>1. Markup del producto (★) — máxima prioridad</span>
        <span>2. Markup de categoría (★) — si no tiene el producto</span>
        <span>3. Markup global — fallback final</span>
      </div>

      {/* ── Búsqueda ──────────────────────────────────────────────────── */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Filtrar categorías..."
          className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* ── Loading / Error ────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <div className="animate-spin text-3xl mr-3">⚙️</div> Cargando...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700
                        flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <strong>Error al cargar categorías.</strong>
            <p className="text-xs mt-0.5 text-red-500">{error}</p>
          </div>
          <button onClick={reload}
            className="ml-auto px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-semibold">
            Reintentar
          </button>
        </div>
      )}

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Encabezado */}
          <div className="grid grid-cols-[1fr_80px_140px_80px_auto] px-5 py-2.5
                          bg-gray-50 border-b border-gray-200
                          text-[11px] font-semibold text-gray-400 uppercase tracking-wider gap-3">
            <span>Categoría</span>
            <span>Prods.</span>
            <span>Markup</span>
            <span>Actualizado</span>
            <span>Acciones</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              {search ? 'No hay categorías que coincidan con la búsqueda' : 'No hay categorías creadas'}
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
                onReload={reload}
              />
            ))
          )}
        </div>
      )}

      {/* ── Modal crear ────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); reload() }}
        />
      )}
    </>
  )
}
