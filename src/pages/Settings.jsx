import { useState, useEffect } from 'react'

export default function Settings() {
  const [globalMarkup, setGlobalMarkup]   = useState(30)
  const [inputMarkup,  setInputMarkup]    = useState('30')
  const [loading,      setLoading]        = useState(true)
  const [saving,       setSaving]         = useState(false)
  const [saved,        setSaved]          = useState(false)
  const [error,        setError]          = useState(null)

  // Ejemplo de precios para preview en vivo
  const EXAMPLES = [
    { label: 'Monitor 24"',     cost_ars: 206062, cost_usd: 145.11 },
    { label: 'Mouse Gamer',     cost_ars:  89990, cost_usd:  63.37 },
    { label: 'Teclado Mec.',    cost_ars: 129990, cost_usd:  91.54 },
  ]

  const fmtARS = (n) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(n)

  const fmtUSD = (n) => `USD ${n.toFixed(2)}`

  const applyMarkup = (cost, pct) => Math.round(cost * (1 + pct / 100))

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const val = parseFloat(data?.global_markup_pct?.value ?? 30)
        setGlobalMarkup(val)
        setInputMarkup(String(val))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const pct = parseFloat(inputMarkup)
    if (!Number.isFinite(pct) || pct < 0 || pct > 500) {
      setError('El markup debe ser un número entre 0 y 500')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ global_markup_pct: pct }),
      })
      if (!res.ok) throw new Error()
      setGlobalMarkup(pct)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const previewPct = parseFloat(inputMarkup) || 0

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Cargando configuración...</div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-bold text-gray-800">⚙️ Configuración</h2>

      {/* ── Markup global ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">💹 Markup global de precios</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Se aplica sobre el precio de costo del mayorista. Los precios de la tienda se calculan en tiempo real.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Slider + input */}
          <div className="flex items-center gap-4">
            <input
              id="markup-slider"
              type="range"
              min="0" max="200" step="1"
              value={Math.min(200, previewPct || 0)}
              onChange={e => setInputMarkup(e.target.value)}
              className="flex-1 accent-blue-600"
            />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                id="markup-input"
                name="markup-input"
                type="number"
                min="0" max="500" step="0.5"
                value={inputMarkup}
                onChange={e => setInputMarkup(e.target.value)}
                className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-semibold
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-lg font-bold text-gray-600">%</span>
            </div>
          </div>

          {/* Preview tabla */}
          <div className="bg-gray-50 rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <span>Producto</span>
              <span className="text-right">Costo</span>
              <span className="text-right">Markup</span>
              <span className="text-right text-blue-600">Precio venta</span>
            </div>
            {EXAMPLES.map(ex => (
              <div key={ex.label} className="grid grid-cols-4 px-4 py-3 text-sm border-b border-gray-100 last:border-0">
                <span className="text-gray-600">{ex.label}</span>
                <span className="text-right text-gray-500">{fmtARS(ex.cost_ars)}</span>
                <span className="text-right text-orange-500">+{previewPct.toFixed(1)}%</span>
                <span className="text-right font-semibold text-gray-800">
                  {fmtARS(applyMarkup(ex.cost_ars, previewPct))}
                </span>
              </div>
            ))}
          </div>

          {/* Info IVA */}
          <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
            <span className="flex-shrink-0">ℹ️</span>
            <div>
              <strong>Los precios de costo ya incluyen IVA</strong> (los mayoristas te facturan con IVA).
              Tu markup cubre tu ganancia e impuestos adicionales. El precio de venta también incluye IVA.
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
          )}

          {/* Botón guardar */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-azure-500 text-white rounded-lg text-sm font-semibold
                         hover:bg-azure-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                ✅ Guardado — los precios de la tienda se actualizaron
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              Markup actual guardado: <strong>{globalMarkup}%</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── Info adicional ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5">
        <h3 className="font-semibold text-gray-800 mb-3">📋 Markup por producto</h3>
        <p className="text-sm text-gray-500">
          Podés sobreescribir el markup global para productos individuales desde la sección
          <strong> Productos</strong> → menú de cada producto. Si un producto no tiene markup
          propio, usa el global configurado arriba.
        </p>
      </div>
    </div>
  )
}
