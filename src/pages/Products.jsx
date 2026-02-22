// src/pages/Products.jsx
// Panel admin — Catálogo con filtro por categoría, markup masivo y toggle visibilidad.
// Lee el parámetro ?q= de la URL para que la búsqueda global del Topbar funcione.

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAdminProducts } from '../hooks/useAdminProducts'
import { useApp } from '../context/AppContext'

const fmtUSD = (n) => n != null
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) : '—'
const fmtARS = (n) => n != null
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n) : '—'

// ── Hook: carga categorías ────────────────────────────────────────────────────
function useCategories() {
  const [categories, setCategories] = useState([])
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setCategories(d.categories || []))
      .catch(() => {})
  }, [])
  return categories
}

// ── Modal: editor de producto (markup + nombre + descripción) ─────────────────
function MarkupModal({ product, globalMarkup, onClose }) {
  const [tab,         setTab]         = useState('precio')
  const [value,       setValue]       = useState(product.markup_pct != null ? String(product.markup_pct) : '')
  const [name,        setName]        = useState(product.name || '')
  const [description, setDescription] = useState(product.description || '')
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState(null)

  const effectiveMarkup = value === '' ? (globalMarkup ?? 0) : parseFloat(value) || 0
  const costArs = product.price_ars_cost ?? 0
  const saleArs = Math.round(costArs * (1 + effectiveMarkup / 100))

  const handleSave = async () => {
    const markup = value === '' ? null : parseFloat(value)
    if (markup !== null && (!Number.isFinite(markup) || markup < 0)) {
      setError('Valor de markup inválido'); return
    }
    if (!name.trim()) {
      setError('El nombre no puede estar vacío'); return
    }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/products/${product.id}/markup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markup_pct: markup, name: name.trim(), description: description.trim() || null }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setTimeout(() => onClose(true), 900)
    } catch {
      setError('Error al guardar')
      setSaving(false)
    }
  }

  const TABS = [
    { id: 'precio',    label: '💹 Precio' },
    { id: 'contenido', label: '✏️ Nombre y descripción' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
         onClick={() => onClose(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
           onClick={e => e.stopPropagation()}>

        <div className="px-6 pt-5 pb-3 border-b border-gray-100">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Editar producto</p>
          <h3 className="font-bold text-gray-800 text-sm leading-snug line-clamp-2">{product.name}</h3>
        </div>

        <div className="flex border-b border-gray-100 px-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`py-3 mr-4 text-sm font-medium border-b-2 transition-all
                ${tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'precio' && (
          <div className="px-6 py-5">
            <p className="text-xs text-gray-500 mb-3">
              Vacío = usa el markup global ({globalMarkup ?? '—'}%).
              Costo: <strong>{fmtARS(costArs)}</strong>
            </p>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number" min="0" max="500" step="0.5"
                placeholder={`Global (${globalMarkup ?? 0}%)`}
                value={value}
                onChange={e => setValue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center
                           font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-lg font-bold text-gray-500">%</span>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between text-gray-500">
                <span>Neto (costo)</span><span>{fmtARS(costArs)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Markup {effectiveMarkup}%{value === '' ? ' (global)' : ''}</span>
                <span className="text-orange-500">+{fmtARS(saleArs - costArs)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800 border-t border-gray-100 pt-2">
                <span>Precio de venta</span>
                <span className="text-blue-600">{fmtARS(saleArs)}</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'contenido' && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Título del producto</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre del producto..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Descripción
                <span className="ml-2 font-normal text-gray-400">
                  {description ? `${description.length} caracteres` : 'Sin descripción'}
                </span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={7}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                placeholder="Ficha técnica o descripción del producto..."
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Formato libre, sin límite.
              </p>
            </div>
          </div>
        )}

        <div className="px-6 pb-5">
          {error  && <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {saved  && <p className="text-xs text-green-600 mb-3 bg-green-50 px-3 py-2 rounded-lg">✅ Guardado</p>}
          <div className="flex gap-2">
            <button onClick={() => onClose(false)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || saved}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold
                         hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Guardando...' : saved ? '✅ Guardado' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: markup masivo por categoría ────────────────────────────────────────
function BulkMarkupModal({ category, globalMarkup, onClose }) {
  const [value,  setValue]  = useState(category.markup_pct != null ? String(category.markup_pct) : '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState(null)

  const handleSave = async () => {
    const markup = value === '' ? null : parseFloat(value)
    if (markup !== null && (!Number.isFinite(markup) || markup < 0 || markup > 500)) {
      setError('Ingresá un número entre 0 y 500'); return
    }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: category.id, markup_pct: markup }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setSaved(true)
      setTimeout(() => onClose(true), 1200)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const effectivePct = value === '' ? (globalMarkup ?? 0) : (parseFloat(value) || 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
         onClick={() => onClose(false)}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-1">
          💹 Markup de categoría: <span className="text-blue-600">{category.name}</span>
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Aplica a <strong>todos los productos</strong> de esta categoría que no tengan markup propio (★).
          Dejá vacío para usar el markup global ({globalMarkup ?? '—'}%).
        </p>

        <div className="flex items-center gap-2 mb-2">
          <input
            type="number" min="0" max="500" step="0.5"
            placeholder={`Global (${globalMarkup ?? 0}%)`}
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center
                       font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-lg font-bold text-gray-500">%</span>
        </div>

        {value !== '' && (
          <button onClick={() => setValue('')}
            className="text-xs text-gray-400 hover:text-red-500 mb-4 block">
            × Quitar markup personalizado (vuelve al global)
          </button>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700 mb-4">
          Los <strong>{category.product_count}</strong> productos de «{category.name}» se venderán
          con <strong>{effectivePct}%</strong> de markup{value === '' ? ' (global)' : ''}.
        </div>

        {error && <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {saved  && <p className="text-xs text-green-600 mb-3 bg-green-50 px-3 py-2 rounded-lg">✅ Guardado</p>}

        <div className="flex gap-2">
          <button onClick={() => onClose(false)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || saved}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold
                       hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Aplicar a categoría'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: markup masivo para productos seleccionados ─────────────────────────
function BulkSelectionModal({ selected, globalMarkup, onClose }) {
  const [value,  setValue]  = useState('')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState(null)

  const handleSave = async () => {
    const markup = value === '' ? null : parseFloat(value)
    if (markup !== null && (!Number.isFinite(markup) || markup < 0 || markup > 500)) {
      setError('Ingresá un número entre 0 y 500'); return
    }
    setSaving(true); setError(null)
    try {
      // Aplica el markup a cada producto seleccionado en paralelo
      await Promise.all(
        selected.map(id =>
          fetch(`/api/products/${id}/markup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ markup_pct: markup }),
          })
        )
      )
      setSaved(true)
      setTimeout(() => onClose(true), 1200)
    } catch {
      setError('Error al guardar uno o más productos')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
         onClick={() => onClose(false)}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-1">
          💹 Markup masivo — <span className="text-blue-600">{selected.length} productos</span>
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Aplica el mismo markup a los {selected.length} productos seleccionados.
          Dejá vacío para volver al markup global ({globalMarkup ?? '—'}%).
        </p>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="number" min="0" max="500" step="0.5"
            placeholder={`Global (${globalMarkup ?? 0}%)`}
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center
                       font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <span className="text-lg font-bold text-gray-500">%</span>
        </div>

        {error && <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {saved  && <p className="text-xs text-green-600 mb-3 bg-green-50 px-3 py-2 rounded-lg">✅ Guardado en {selected.length} productos</p>}

        <div className="flex gap-2">
          <button onClick={() => onClose(false)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || saved}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold
                       hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Guardando...' : `Aplicar a ${selected.length} productos`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toggle visibilidad ────────────────────────────────────────────────────────
function VisibilityToggle({ product, onToggled }) {
  const [loading, setLoading] = useState(false)
  const isActive = product.active !== false && product.active !== 0

  const toggle = async (e) => {
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${product.id}/markup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: !isActive }),
      })
      if (!res.ok) throw new Error()
      onToggled()
    } catch {
      // silencio
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={isActive ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}
      className={`w-8 h-8 rounded-lg border text-sm transition-all flex items-center justify-center
        ${loading ? 'opacity-40 cursor-wait' :
          isActive
            ? 'border-green-200 bg-green-50 text-green-600 hover:bg-red-50 hover:border-red-200 hover:text-red-500'
            : 'border-red-200 bg-red-50 text-red-400 hover:bg-green-50 hover:border-green-200 hover:text-green-600'}`}
    >
      {loading ? '…' : isActive ? '👁' : '🚫'}
    </button>
  )
}

// ── Toggle destacado ──────────────────────────────────────────────────────────
function FeaturedToggle({ product, onToggled }) {
  const [loading, setLoading] = useState(false)
  const isFeatured = product.featured === true || product.featured === 1

  const toggle = async (e) => {
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${product.id}/markup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ featured: !isFeatured }),
      })
      if (!res.ok) throw new Error()
      onToggled()
    } catch {
      // silencio
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={isFeatured ? 'Quitar de destacados' : 'Marcar como destacado'}
      className={`w-8 h-8 rounded-lg border text-sm transition-all flex items-center justify-center
        ${loading ? 'opacity-40 cursor-wait' :
          isFeatured
            ? 'border-yellow-300 bg-yellow-50 text-yellow-500 hover:bg-gray-50 hover:border-gray-200 hover:text-gray-400'
            : 'border-gray-200 bg-gray-50 text-gray-300 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-500'}`}
    >
      {loading ? '…' : '⭐'}
    </button>
  )
}

// ── Vista LISTA ───────────────────────────────────────────────────────────────
function ListView({ products, globalMarkup, selected, onSelect, onSelectAll, onMarkup, onReload }) {
  const allSelected = products.length > 0 && products.every(p => selected.has(p.id))

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-[32px_1fr_110px_70px_105px_105px_100px_80px_72px_60px] px-4 py-2.5
                      bg-gray-50 border-b border-gray-200
                      text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        {/* Checkbox seleccionar todos */}
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onSelectAll(allSelected ? [] : products.map(p => p.id))}
            className="w-3.5 h-3.5 rounded cursor-pointer"
          />
        </div>
        <span>Producto</span>
        <span>Proveedor / Cat.</span>
        <span className="text-center">Stock</span>
        <span className="text-right">Costo USD</span>
        <span className="text-right text-blue-600">Neto</span>
        <span className="text-right">Markup</span>
        <span className="text-right text-green-600">Venta ARS</span>
        <span className="text-center">Tienda</span>
        <span className="text-center">Dest.</span>
      </div>

      {products.map((p, i) => {
        const costArs   = p.price_ars_cost ?? 0
        const saleArs   = p.price_ars ?? 0
        const markupPct = p.markup_pct != null ? p.markup_pct : globalMarkup ?? 0
        const isCustom  = p.markup_pct != null
        const isActive  = p.active !== false && p.active !== 0
        const isChecked = selected.has(p.id)

        return (
          <div key={p.id}
            className={`grid grid-cols-[32px_1fr_110px_70px_105px_105px_100px_80px_72px_60px]
                        px-4 py-3 text-sm border-b border-gray-100 last:border-0 items-center gap-1
                        ${isChecked ? 'bg-blue-50/60' :
                          !isActive ? 'opacity-50 bg-gray-50/80' :
                          i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>

            {/* Checkbox individual */}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onSelect(p.id)}
                className="w-3.5 h-3.5 rounded cursor-pointer"
              />
            </div>

            {/* Nombre */}
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate text-xs leading-tight">{p.name}</p>
              {p.brand && <p className="text-[10px] text-gray-400 truncate">{p.brand} · {p.sku}</p>}
            </div>

            <div className="text-[10px] text-gray-500">
              <p className="capitalize font-medium truncate">{p.provider ?? '—'}</p>
              <p className="text-gray-400 truncate">{p.category ?? '—'}</p>
            </div>

            <div className="text-center">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                ${p.stock > 10 ? 'bg-green-100 text-green-700'
                  : p.stock > 0 ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-600'}`}>
                {p.stock}
              </span>
            </div>

            <div className="text-right text-xs text-gray-500 font-mono">
              {fmtUSD(p.price_usd_cost ?? p.price_usd)}
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-blue-700 font-mono">{fmtARS(costArs)}</span>
            </div>

            <div className="text-right">
              <button onClick={() => onMarkup(p)}
                className={`text-xs font-semibold px-1.5 py-0.5 rounded cursor-pointer
                  hover:ring-2 hover:ring-blue-400 transition-all
                  ${isCustom ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
                title="Cambiar markup de este producto">
                {markupPct}%{isCustom && <span className="text-[9px] ml-0.5">★</span>}
              </button>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-green-700 font-mono">{fmtARS(saleArs)}</span>
            </div>

            <div className="flex justify-center">
              <VisibilityToggle product={p} onToggled={onReload} />
            </div>

            <div className="flex justify-center">
              <FeaturedToggle product={p} onToggled={onReload} />
            </div>
          </div>
        )
      })}

      {products.length === 0 && (
        <div className="py-16 text-center text-gray-400 text-sm">No se encontraron productos</div>
      )}
    </div>
  )
}

// ── Vista GRILLA ──────────────────────────────────────────────────────────────
function GridView({ products, globalMarkup, selected, onSelect, onMarkup, onReload }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {products.map(p => {
        const costArs   = p.price_ars_cost ?? p.price_ars
        const saleArs   = p.price_ars
        const hasCustom = p.markup_pct != null
        const isActive  = p.active !== false && p.active !== 0
        const isChecked = selected.has(p.id)

        return (
          <div key={p.id}
            className={`bg-white rounded-xl border overflow-hidden hover:shadow-md transition-all group relative
              ${isChecked ? 'border-blue-400 ring-2 ring-blue-200' :
                isActive ? 'border-gray-200' : 'border-red-200 opacity-60'}`}>

            {/* Checkbox en esquina */}
            <div className="absolute top-2 left-2 z-10">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onSelect(p.id)}
                className="w-4 h-4 rounded cursor-pointer shadow"
                onClick={e => e.stopPropagation()}
              />
            </div>

            <div className="h-28 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
              {p.image_url
                ? <img src={p.image_url} alt={p.name}
                    className="h-full w-full object-contain p-2" loading="lazy"
                    onError={e => { e.target.style.display = 'none' }} />
                : <span className="text-4xl select-none">📦</span>
              }
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button onClick={() => onMarkup(p)} title="Ajustar markup"
                  className="w-6 h-6 bg-blue-500 text-white rounded-full text-[10px]
                             flex items-center justify-center hover:bg-blue-600">
                  %
                </button>
              </div>
              {!isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="text-xs bg-red-500 text-white font-bold px-2 py-1 rounded">🚫 Oculto</span>
                </div>
              )}
              {p.stock === 0 && isActive && (
                <span className="absolute bottom-1.5 left-1.5 text-[9px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded">
                  Sin stock
                </span>
              )}
            </div>

            <div className="p-3">
              <h4 className="text-xs font-semibold mb-0.5 line-clamp-2 text-gray-800">{p.name}</h4>
              {p.brand && <p className="text-[10px] text-gray-400 mb-2">{p.brand} · {p.category}</p>}
              <div className="space-y-0.5 mb-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-gray-400">Neto</span>
                  <span className="text-blue-600 font-semibold">{fmtARS(costArs)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    Venta
                    {hasCustom
                      ? <span className="text-blue-500 text-[9px] font-bold">({p.markup_pct}%★)</span>
                      : <span className="text-gray-300 text-[9px]">(global)</span>}
                  </span>
                  <span className="text-sm font-bold text-green-600">{fmtARS(saleArs)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  {p.stock > 10 ? '✅' : p.stock > 0 ? '⚠️' : '❌'} {p.stock} uds
                </span>
                <div className="flex gap-1">
                  <FeaturedToggle product={p} onToggled={onReload} />
                  <VisibilityToggle product={p} onToggled={onReload} />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Products() {
  const { adminCategoryFilter, setAdminCategoryFilter } = useApp()
  const [searchParams] = useSearchParams()

  const [search,          setSearch]          = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter,  setCategoryFilter]  = useState('')
  const [markupModal,     setMarkupModal]     = useState(null)
  const [bulkModal,       setBulkModal]       = useState(null)
  const [bulkSelModal,    setBulkSelModal]    = useState(false)
  const [selected,        setSelected]        = useState(new Set())
  const [vista,           setVista]           = useState('lista')

  // ── Leer búsqueda desde URL (?q=) — para que el buscador del Topbar funcione
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setSearch(q)
      setDebouncedSearch(q)
    }
  }, []) // solo al montar

  // Si venimos de Categorías con un filtro pre-seleccionado
  useEffect(() => {
    if (adminCategoryFilter) {
      setCategoryFilter(adminCategoryFilter)
      setAdminCategoryFilter('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categories = useCategories()

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { products, total, loading, error, globalMarkup, reload } = useAdminProducts({
    buscar:    debouncedSearch || undefined,
    categoria: categoryFilter  || undefined,
  })

  const stats = useMemo(() => ({
    sinStock:        products.filter(p => p.stock === 0).length,
    conMarkupCustom: products.filter(p => p.markup_pct != null).length,
    ocultos:         products.filter(p => p.active === false || p.active === 0).length,
  }), [products])

  const selectedCategory = categoryFilter
    ? categories.find(c => c.name === categoryFilter)
    : null

  // ── Handlers de selección ─────────────────────────────────────────────────
  const handleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((ids) => {
    setSelected(new Set(ids))
  }, [])

  const clearSelection = () => setSelected(new Set())

  return (
    <>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-lg text-gray-800">
            🏷️ Catálogo de Productos
            <span className="ml-2 text-sm font-normal text-gray-400">
              {loading ? 'cargando...' : `${total} productos`}
            </span>
          </h3>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.sinStock > 0 && <span className="text-red-400">{stats.sinStock} sin stock · </span>}
              {stats.ocultos > 0  && <span className="text-orange-400">{stats.ocultos} ocultos · </span>}
              {stats.conMarkupCustom} con markup propio ·{' '}
              Markup global: <strong>{globalMarkup ?? '—'}%</strong>
            </p>
          )}
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setVista('lista')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${vista === 'lista' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            ☰ Lista
          </button>
          <button onClick={() => setVista('grilla')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${vista === 'grilla' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            ⊞ Grilla
          </button>
        </div>
      </div>

      {/* ── Barra de selección masiva (aparece cuando hay productos seleccionados) */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-blue-600 rounded-xl text-white text-sm font-medium
                        shadow-lg shadow-blue-200">
          <span className="flex-1">
            ✅ <strong>{selected.size}</strong> producto{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setBulkSelModal(true)}
            className="px-3 py-1.5 bg-white text-blue-600 rounded-lg font-semibold text-xs hover:bg-blue-50">
            💹 Aplicar markup
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-400">
            Deseleccionar todo
          </button>
        </div>
      )}

      {/* ── Leyenda ───────────────────────────────────────────────────────── */}
      {vista === 'lista' && !loading && (
        <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-blue-700">★</span> Markup personalizado por producto
          </span>
          <span className="flex items-center gap-1.5">
            <span>👁</span> Visible en tienda — click para ocultar
          </span>
          <span className="flex items-center gap-1.5">
            <span>🚫</span> Oculto — click para mostrar
          </span>
          <span className="flex items-center gap-1.5">
            <input type="checkbox" readOnly className="w-3 h-3" /> Seleccioná para markup masivo
          </span>
        </div>
      )}

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre, marca, SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-sm px-4 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
          >
            <option value="">Todas las categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>
                {c.name} ({c.product_count})
              </option>
            ))}
          </select>

          {selectedCategory && (
            <button
              onClick={() => setBulkModal(selectedCategory)}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm
                         font-semibold rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
              title={`Cambiar markup de todos los productos de ${selectedCategory.name}`}
            >
              💹 Markup de «{selectedCategory.name}»
            </button>
          )}

          {(categoryFilter || search) && (
            <button
              onClick={() => { setCategoryFilter(''); setSearch('') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2 underline whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Estados ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="animate-spin text-3xl mr-3">⚙️</div>
          Cargando productos...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <strong>No se pudieron cargar los productos.</strong>
            <p className="text-xs mt-0.5 text-red-500">{error}</p>
          </div>
          <button onClick={reload}
            className="ml-auto px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-semibold">
            Reintentar
          </button>
        </div>
      )}

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      {!loading && !error && (
        vista === 'lista'
          ? <ListView
              products={products} globalMarkup={globalMarkup}
              selected={selected} onSelect={handleSelect} onSelectAll={handleSelectAll}
              onMarkup={setMarkupModal} onReload={reload}
            />
          : <GridView
              products={products} globalMarkup={globalMarkup}
              selected={selected} onSelect={handleSelect}
              onMarkup={setMarkupModal} onReload={reload}
            />
      )}

      {/* ── Modales ───────────────────────────────────────────────────────── */}
      {markupModal && (
        <MarkupModal
          product={markupModal}
          globalMarkup={globalMarkup}
          onClose={(saved) => { setMarkupModal(null); if (saved) reload() }}
        />
      )}

      {bulkModal && (
        <BulkMarkupModal
          category={bulkModal}
          globalMarkup={globalMarkup}
          onClose={(saved) => { setBulkModal(null); if (saved) reload() }}
        />
      )}

      {bulkSelModal && (
        <BulkSelectionModal
          selected={[...selected]}
          globalMarkup={globalMarkup}
          onClose={(saved) => {
            setBulkSelModal(false)
            if (saved) { clearSelection(); reload() }
          }}
        />
      )}
    </>
  )
}
