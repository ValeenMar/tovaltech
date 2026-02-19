// src/pages/Products.jsx
// Panel admin — Catálogo de productos conectado a Azure SQL.
// Lee precios reales del mayorista (neto con IVA incluido) y permite
// ajustar markup global e individual por producto.

import { useState, useMemo } from 'react'
import { useAdminProducts } from '../hooks/useAdminProducts'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtUSD = (n) => n != null
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
  : '—'

const fmtARS = (n) => n != null
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  : '—'

// ── Modal markup por producto ─────────────────────────────────────────────────
function MarkupModal({ product, globalMarkup, onClose }) {
  const [value,  setValue]  = useState(product.markup_pct != null ? String(product.markup_pct) : '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const effectiveMarkup = value === '' ? (globalMarkup ?? 0) : parseFloat(value) || 0
  const costArs = product.price_ars_cost ?? 0
  const saleArs = Math.round(costArs * (1 + effectiveMarkup / 100))

  const handleSave = async () => {
    const markup = value === '' ? null : parseFloat(value)
    if (markup !== null && (!Number.isFinite(markup) || markup < 0)) {
      setError('Valor inválido'); return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/products/${product.id}/markup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markup_pct: markup }),
      })
      if (!res.ok) throw new Error()
      onClose(true)
    } catch {
      setError('Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
         onClick={() => onClose(false)}>
      <div className="bg-white rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-1 text-sm">💹 Markup: {product.name}</h3>
        <p className="text-xs text-gray-500 mb-4">
          Dejá vacío para usar el markup global ({globalMarkup ?? '—'}%).
          El precio de costo (neto + IVA) es <strong>{fmtARS(costArs)}</strong>.
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

        {/* Preview precio */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm mb-4 space-y-1.5">
          <div className="flex justify-between text-gray-500">
            <span>Neto + IVA (costo)</span>
            <span>{fmtARS(costArs)}</span>
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

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={() => onClose(false)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold
                       hover:bg-blue-700 disabled:opacity-50">
            {saving ? '...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vista LISTA — tabla con precios neto + IVA ────────────────────────────────
function ListView({ products, globalMarkup, onMarkup }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Encabezado */}
      <div className="grid grid-cols-[1fr_120px_80px_110px_110px_110px_90px_44px] px-4 py-2.5
                      bg-gray-50 border-b border-gray-200
                      text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        <span>Producto</span>
        <span>Proveedor / Cat.</span>
        <span className="text-center">Stock</span>
        <span className="text-right">Costo USD</span>
        <span className="text-right text-blue-600">Neto + IVA</span>
        <span className="text-right">Markup</span>
        <span className="text-right text-green-600">Venta ARS</span>
        <span></span>
      </div>

      {products.map((p, i) => {
        const costArs   = p.price_ars_cost ?? p.price_ars ?? 0
        const saleArs   = p.price_ars ?? 0
        const markupPct = p.markup_pct != null ? p.markup_pct : globalMarkup ?? 0
        const isCustom  = p.markup_pct != null

        return (
          <div key={p.id}
            className={`grid grid-cols-[1fr_120px_80px_110px_110px_110px_90px_44px]
                        px-4 py-3 text-sm border-b border-gray-100 last:border-0 items-center
                        ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>

            {/* Nombre */}
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate text-xs leading-tight">{p.name}</p>
              {p.brand && (
                <p className="text-[10px] text-gray-400 truncate">{p.brand} · {p.sku}</p>
              )}
            </div>

            {/* Proveedor / Categoría */}
            <div className="text-[10px] text-gray-500">
              <p className="capitalize font-medium">{p.provider ?? '—'}</p>
              <p className="text-gray-400 truncate">{p.category ?? '—'}</p>
            </div>

            {/* Stock */}
            <div className="text-center">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                ${p.stock > 10 ? 'bg-green-100 text-green-700'
                  : p.stock > 0 ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-600'}`}>
                {p.stock}
              </span>
            </div>

            {/* Costo USD */}
            <div className="text-right text-xs text-gray-500 font-mono">
              {fmtUSD(p.price_usd_cost ?? p.price_usd)}
            </div>

            {/* Neto + IVA (ARS costo) — columna principal de esta vista */}
            <div className="text-right">
              <span className="text-xs font-bold text-blue-700 font-mono">
                {fmtARS(costArs)}
              </span>
            </div>

            {/* Markup */}
            <div className="text-right">
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded
                ${isCustom ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {markupPct}%
                {isCustom && <span className="text-[9px] ml-0.5">★</span>}
              </span>
            </div>

            {/* Venta ARS */}
            <div className="text-right">
              <span className="text-xs font-bold text-green-700 font-mono">
                {fmtARS(saleArs)}
              </span>
            </div>

            {/* Acción markup */}
            <div className="flex justify-center">
              <button
                onClick={() => onMarkup(p)}
                title="Ajustar markup"
                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400
                           hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50
                           text-[11px] font-bold transition-all">
                %
              </button>
            </div>
          </div>
        )
      })}

      {products.length === 0 && (
        <div className="py-16 text-center text-gray-400 text-sm">
          No se encontraron productos
        </div>
      )}
    </div>
  )
}

// ── Vista GRILLA — tarjetas ───────────────────────────────────────────────────
function GridView({ products, globalMarkup, onMarkup }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {products.map(p => {
        const costArs      = p.price_ars_cost ?? p.price_ars
        const saleArs      = p.price_ars
        const hasCustom    = p.markup_pct != null

        return (
          <div key={p.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all group">
            {/* Imagen */}
            <div className="h-28 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
              {p.image_url
                ? <img src={p.image_url} alt={p.name}
                    className="h-full w-full object-contain p-2"
                    loading="lazy" onError={e => { e.target.style.display = 'none' }} />
                : <span className="text-4xl select-none">📦</span>
              }

              {/* Acción hover */}
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onMarkup(p)} title="Ajustar markup"
                  className="w-6 h-6 bg-blue-500 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-blue-600">
                  %
                </button>
              </div>

              {p.featured && (
                <span className="absolute top-1.5 left-1.5 text-[9px] bg-yellow-400 text-yellow-900 font-bold px-1.5 py-0.5 rounded">
                  ⭐ Dest.
                </span>
              )}

              {/* Badge stock 0 */}
              {p.stock === 0 && (
                <span className="absolute bottom-1.5 left-1.5 text-[9px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded">
                  Sin stock
                </span>
              )}
            </div>

            <div className="p-3">
              <h4 className="text-xs font-semibold mb-0.5 line-clamp-2 text-gray-800">{p.name}</h4>
              {p.brand && <p className="text-[10px] text-gray-400 mb-2">{p.brand} · {p.category}</p>}

              <div className="space-y-0.5">
                {/* Costo neto + IVA */}
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-gray-400">Neto+IVA</span>
                  <span className="text-blue-600 font-semibold">{fmtARS(costArs)}</span>
                </div>
                {/* Precio venta */}
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    Venta
                    {hasCustom
                      ? <span className="text-blue-500 text-[9px] font-bold">({p.markup_pct}%★)</span>
                      : <span className="text-gray-300 text-[9px]">(global)</span>
                    }
                  </span>
                  <span className="text-sm font-bold text-green-600">{fmtARS(saleArs)}</span>
                </div>
              </div>

              <div className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                <span>{p.stock > 10 ? '✅' : p.stock > 0 ? '⚠️' : '❌'}</span>
                <span>{p.stock} en stock</span>
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
  const [search,      setSearch]      = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [markupModal, setMarkupModal] = useState(null)
  const [vista,       setVista]       = useState('lista')   // 'lista' | 'grilla'

  // Debounce de búsqueda (300ms)
  useMemo(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Datos reales desde Azure SQL
  const { products, total, loading, error, globalMarkup, reload } = useAdminProducts({
    buscar: debouncedSearch || undefined,
  })

  // Stats rápidas
  const stats = useMemo(() => ({
    sinStock: products.filter(p => p.stock === 0).length,
    conMarkupCustom: products.filter(p => p.markup_pct != null).length,
  }), [products])

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
              {stats.conMarkupCustom} con markup personalizado ·{' '}
              Markup global: <strong>{globalMarkup ?? '—'}%</strong>
            </p>
          )}
        </div>

        {/* Toggle vista */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setVista('lista')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${vista === 'lista' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              ☰ Lista
            </button>
            <button
              onClick={() => setVista('grilla')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${vista === 'grilla' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              ⊞ Grilla
            </button>
          </div>
        </div>
      </div>

      {/* ── Leyenda vista lista ─────────────────────────────────────────────── */}
      {vista === 'lista' && !loading && (
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            Neto + IVA = precio que te cobra el mayorista (impuesto incluido)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-blue-700">★</span>
            Markup personalizado por producto
          </span>
        </div>
      )}

      {/* ── Búsqueda ───────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre, marca, categoría o SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* ── Estados loading / error ─────────────────────────────────────────── */}
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

      {/* ── Contenido ──────────────────────────────────────────────────────── */}
      {!loading && !error && (
        vista === 'lista'
          ? <ListView    products={products} globalMarkup={globalMarkup} onMarkup={setMarkupModal} />
          : <GridView    products={products} globalMarkup={globalMarkup} onMarkup={setMarkupModal} />
      )}

      {/* ── Modal markup ────────────────────────────────────────────────────── */}
      {markupModal && (
        <MarkupModal
          product={markupModal}
          globalMarkup={globalMarkup}
          onClose={(saved) => {
            setMarkupModal(null)
            if (saved) reload()   // recarga datos reales tras guardar
          }}
        />
      )}
    </>
  )
}