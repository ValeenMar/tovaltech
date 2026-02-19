import { useState } from 'react'
import { useApp } from '../context/AppContext'

const fmtUSD = (n) => n != null
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
  : '—'

const fmtARS = (n) => n != null
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  : '—'

// Modal de markup por producto
function MarkupModal({ product, onClose }) {
  const [value, setValue] = useState(
    product.markup_pct != null ? String(product.markup_pct) : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const effectiveMarkup = value === '' ? null : parseFloat(value)
  const costArs  = product.price_ars_cost ?? product.price_ars ?? 0
  const saleArs  = effectiveMarkup != null
    ? Math.round(costArs * (1 + effectiveMarkup / 100))
    : costArs  // fallback visual (global no lo conocemos aquí)

  const handleSave = async () => {
    const markup = value === '' ? null : parseFloat(value)
    if (markup !== null && (!Number.isFinite(markup) || markup < 0)) {
      setError('Valor inválido')
      return
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => onClose(false)}>
      <div className="bg-white rounded-2xl p-6 w-[90%] max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-1">💹 Markup: {product.name}</h3>
        <p className="text-xs text-gray-500 mb-4">
          Dejá vacío para usar el markup global. El precio de costo es <strong>{fmtARS(costArs)}</strong>.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <input
            id={`markup-product-${product.id}`}
            name={`markup-product-${product.id}`}
            type="number"
            min="0" max="500" step="0.5"
            placeholder="Global"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-semibold
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-lg font-bold text-gray-500">%</span>
        </div>

        {effectiveMarkup != null && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm mb-4">
            <div className="flex justify-between text-gray-500 mb-1">
              <span>Costo</span>
              <span>{fmtARS(costArs)}</span>
            </div>
            <div className="flex justify-between text-gray-500 mb-1">
              <span>Markup {effectiveMarkup}%</span>
              <span className="text-orange-500">+{fmtARS(saleArs - costArs)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-800 border-t border-gray-100 pt-2 mt-1">
              <span>Precio venta</span>
              <span className="text-blue-600">{fmtARS(saleArs)}</span>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={() => onClose(false)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-azure-500 text-white text-sm font-semibold hover:bg-azure-600 disabled:opacity-50">
            {saving ? '...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Products() {
  const { products, openModal, removeProduct } = useApp()
  const [search, setSearch]           = useState('')
  const [markupModal, setMarkupModal]  = useState(null)
  const [globalMarkup, setGlobalMarkup] = useState(null)   // null = no cargado
  const [markupInput,  setMarkupInput]  = useState('')
  const [savingMarkup, setSavingMarkup] = useState(false)
  const [markupSaved,  setMarkupSaved]  = useState(false)
  const [showMarkupBar, setShowMarkupBar] = useState(false)

  // Cargar markup global al montar
  useState(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const v = data?.global_markup_pct?.value ?? '30'
        setGlobalMarkup(parseFloat(v))
        setMarkupInput(v)
      })
      .catch(() => {})
  }, [])

  const handleSaveMarkup = async () => {
    const pct = parseFloat(markupInput)
    if (!Number.isFinite(pct) || pct < 0) return
    setSavingMarkup(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ global_markup_pct: pct }),
      })
      setGlobalMarkup(pct)
      setMarkupSaved(true)
      setTimeout(() => { setMarkupSaved(false); setShowMarkupBar(false) }, 2500)
    } catch {}
    setSavingMarkup(false)
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-lg">🏷️ Catálogo de Productos
          <span className="ml-2 text-sm font-normal text-gray-400">({products.length} productos)</span>
        </h3>
        <div className="flex items-center gap-2">
          {/* Markup global rápido */}
          <button
            onClick={() => setShowMarkupBar(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all
              ${showMarkupBar
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
          >
            💹 Markup global
            {globalMarkup !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold
                ${showMarkupBar ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                {globalMarkup}%
              </span>
            )}
          </button>
          <button
            onClick={() => openModal('product')}
            className="px-4 py-2 bg-azure-500 text-white rounded-lg text-sm font-semibold hover:bg-azure-600"
          >
            + Nuevo Producto
          </button>
        </div>
      </div>

      {/* Barra markup inline */}
      {showMarkupBar && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 mb-5 flex flex-wrap items-center gap-3">
          <span className="text-sm text-blue-700 font-medium">Markup global sobre precio de costo:</span>
          <div className="flex items-center gap-2 flex-1">
            <input
              id="products-global-markup"
              name="products-global-markup"
              type="range" min="0" max="200" step="1"
              value={Math.min(200, parseFloat(markupInput) || 0)}
              onChange={e => setMarkupInput(e.target.value)}
              className="w-40 accent-blue-600"
            />
            <input
              id="products-global-markup-num"
              name="products-global-markup-num"
              type="number" min="0" max="500" step="0.5"
              value={markupInput}
              onChange={e => setMarkupInput(e.target.value)}
              className="w-16 px-2 py-1 border border-blue-200 rounded-lg text-sm text-center font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-bold text-blue-600">%</span>
          </div>
          <button
            onClick={handleSaveMarkup}
            disabled={savingMarkup}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {savingMarkup ? '...' : 'Guardar'}
          </button>
          {markupSaved && <span className="text-sm text-green-600 font-medium">✅ Guardado</span>}
        </div>
      )}

      {/* Búsqueda */}
      <div className="mb-4">
        <input
          id="admin-products-search"
          name="admin-products-search"
          type="text"
          placeholder="🔍 Buscar por nombre, marca o categoría..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-azure-500"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {filtered.map(p => {
          const costArs = p.price_ars_cost ?? p.price_ars
          const saleArs = p.price_ars
          const hasCustomMarkup = p.markup_pct != null

          return (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all group"
            >
              {/* Imagen */}
              <div className="h-28 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden relative">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name}
                      className="h-full w-full object-contain p-2"
                      loading="lazy" onError={e => { e.target.style.display='none' }} />
                  : <span className="text-4xl select-none">{p.emoji ?? '📦'}</span>
                }

                {/* Acciones hover */}
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setMarkupModal(p)}
                    title="Ajustar markup"
                    className="w-6 h-6 bg-blue-500 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-blue-600"
                  >%</button>
                  <button
                    onClick={() => removeProduct(p.id)}
                    title="Eliminar"
                    className="w-6 h-6 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-red-600"
                  >✕</button>
                </div>

                {/* Badges */}
                {p.featured && (
                  <span className="absolute top-1.5 left-1.5 text-[9px] bg-yellow-400 text-yellow-900 font-bold px-1.5 py-0.5 rounded">
                    ⭐ Dest.
                  </span>
                )}
              </div>

              <div className="p-3">
                <h4 className="text-xs font-semibold mb-0.5 line-clamp-2 text-gray-800">{p.name}</h4>
                {p.brand && <p className="text-[10px] text-gray-400 mb-1.5">{p.brand} · {p.category}</p>}

                {/* Precios */}
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-400">Costo</span>
                    <span className="text-gray-500">{fmtUSD(p.price_usd_cost ?? p.price_usd)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      Venta
                      {hasCustomMarkup
                        ? <span className="text-blue-500 text-[9px] font-bold">({p.markup_pct}%)</span>
                        : <span className="text-gray-300 text-[9px]">(global)</span>
                      }
                    </span>
                    <span className="text-sm font-bold text-azure-500">{fmtUSD(p.price_usd)}</span>
                  </div>
                </div>

                {/* Stock */}
                <div className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                  <span>{p.stock > 10 ? '✅' : p.stock > 0 ? '⚠️' : '❌'}</span>
                  <span>{p.stock} en stock</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal markup */}
      {markupModal && (
        <MarkupModal
          product={markupModal}
          onClose={(saved) => {
            setMarkupModal(null)
            // Si se guardó, el cambio está en la DB — al recargar se verá actualizado
          }}
        />
      )}
    </>
  )
}
