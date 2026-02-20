import { useState, useEffect, useCallback } from 'react'

// ── Panel de sincronización ──────────────────────────────────────────────────
function SyncPanel() {
  const [lastSync,  setLastSync]  = useState(null)
  const [syncing,   setSyncing]   = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const res  = await fetch('/api/settings')
      const data = await res.json()
      const raw  = data?.last_sync_result?.value
      if (raw && raw !== '{}') {
        setLastSync(JSON.parse(raw))
      }
    } catch { /* silencio */ }
    finally { setLoadingStatus(false) }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res  = await fetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      setLastSync(data)
    } catch (e) {
      setLastSync({ success: false, error: e.message, timestamp: new Date().toISOString() })
    } finally {
      setSyncing(false)
    }
  }

  const fmtTime = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const isOk = lastSync?.success

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-800">🔄 Sincronización de productos</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Actualiza el catálogo desde las APIs de Elit y NewBytes + tipo de cambio oficial.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold
                     rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {syncing
            ? <><span className="animate-spin inline-block">⚙️</span> Sincronizando...</>
            : '▶ Sincronizar ahora'}
        </button>
      </div>

      <div className="px-6 py-5">
        {loadingStatus ? (
          <p className="text-sm text-gray-400">Cargando estado...</p>
        ) : !lastSync ? (
          <p className="text-sm text-gray-400">
            No hay sincronizaciones registradas. Corré el primer sync con el botón.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Estado general */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
              ${isOk
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'}`}>
              <span className="text-xl">{isOk ? '✅' : '❌'}</span>
              <div className="flex-1">
                <span>{isOk ? 'Sync exitoso' : `Error: ${lastSync.error}`}</span>
                {lastSync.duration_sec && (
                  <span className="ml-2 text-xs opacity-70">({lastSync.duration_sec}s)</span>
                )}
              </div>
              <span className="text-xs font-normal opacity-70">{fmtTime(lastSync.timestamp)}</span>
            </div>

            {/* Stats del último sync exitoso */}
            {isOk && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Dólar oficial', value: `$${lastSync.dolar_oficial?.toLocaleString('es-AR') ?? '—'}` },
                  { label: 'Total procesados', value: lastSync.total?.toLocaleString('es-AR') ?? '—', highlight: true },
                  {
                    label: 'Elit',
                    value: lastSync.elit
                      ? `${lastSync.elit.parsed?.toLocaleString('es-AR')} parseados · ${lastSync.elit.inserted} nuevos · ${lastSync.elit.updated} actualizados`
                      : '—',
                    full: true,
                  },
                  {
                    label: 'NewBytes',
                    value: lastSync.newbytes
                      ? `${lastSync.newbytes.parsed?.toLocaleString('es-AR')} parseados · ${lastSync.newbytes.inserted} nuevos · ${lastSync.newbytes.updated} actualizados`
                      : '—',
                    full: true,
                  },
                ].filter(s => !s.full).map(stat => (
                  <div key={stat.label}
                    className={`rounded-xl px-4 py-3 text-center
                      ${stat.highlight ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
                    <p className={`text-base font-bold ${stat.highlight ? 'text-blue-700' : 'text-gray-700'}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}

                {/* Elit y NewBytes en filas separadas con más detalle */}
                {lastSync.elit && (
                  <div className="col-span-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">Elit</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-600">{lastSync.elit.parsed?.toLocaleString()} <span className="text-gray-400 text-xs">parseados</span></span>
                      <span className="text-green-600 font-semibold">+{lastSync.elit.inserted} <span className="text-gray-400 font-normal text-xs">nuevos</span></span>
                      <span className="text-blue-600 font-semibold">{lastSync.elit.updated} <span className="text-gray-400 font-normal text-xs">actualizados</span></span>
                    </div>
                  </div>
                )}
                {lastSync.newbytes && (
                  <div className="col-span-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">NewBytes</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-600">{lastSync.newbytes.parsed?.toLocaleString()} <span className="text-gray-400 text-xs">parseados</span></span>
                      <span className="text-green-600 font-semibold">+{lastSync.newbytes.inserted} <span className="text-gray-400 font-normal text-xs">nuevos</span></span>
                      <span className="text-blue-600 font-semibold">{lastSync.newbytes.updated} <span className="text-gray-400 font-normal text-xs">actualizados</span></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-400">
              El sync local corre cada 20 minutos automáticamente. Este botón lo corre manualmente desde Azure Functions.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Settings principal ───────────────────────────────────────────────────────
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

      {/* ── Panel de sync ────────────────────────────────────────────── */}
      <SyncPanel />

      {/* ── Markup global ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">💹 Markup global de precios</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Fallback cuando un producto o categoría no tiene markup propio.
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

      {/* ── Info jerarquía de markup ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5">
        <h3 className="font-semibold text-gray-800 mb-3">📋 Jerarquía de markup</h3>
        <div className="space-y-2 text-sm text-gray-500">
          <div className="flex items-start gap-3">
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full mt-0.5">1°</span>
            <div>
              <strong className="text-gray-700">Markup por producto</strong>
              <p className="text-xs text-gray-400">Se setea desde la sección Productos → botón %. Máxima prioridad.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full mt-0.5">2°</span>
            <div>
              <strong className="text-gray-700">Markup por categoría</strong>
              <p className="text-xs text-gray-400">Se setea desde la sección Categorías. Aplica a todos los productos de esa categoría que no tengan markup propio.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full mt-0.5">3°</span>
            <div>
              <strong className="text-gray-700">Markup global (esta pantalla)</strong>
              <p className="text-xs text-gray-400">Fallback final. Se usa cuando el producto y su categoría no tienen markup personalizado.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Simulador Mercado Pago ────────────────────────────────────── */}
      <MercadoPagoSimulator fmtARS={fmtARS} />
    </div>
  )
}

// ── Tasas MP Argentina — Checkout Pro ────────────────────────────────────────
const MP_PLANS = [
  { id: 'instant', label: 'Inmediata',   days: 'Al instante',    rate: 0.0629 },
  { id: 'd7',      label: '7 días',      days: 'En ~7 días',     rate: 0.0349 },
  { id: 'd14',     label: '14 días',     days: 'En ~14 días',    rate: 0.0249 },
  { id: 'd30',     label: '30+ días',    days: 'En ~30-35 días', rate: 0.0149 },
]

const IVA_RATE = 0.21

function MercadoPagoSimulator({ fmtARS }) {
  const [planId,    setPlanId]    = useState('d7')
  const [saleInput, setSaleInput] = useState('150000')
  const [showAll,   setShowAll]   = useState(false)

  const saleAmount = parseFloat(saleInput.replace(/\./g, '').replace(',', '.')) || 0
  const activePlan = MP_PLANS.find(p => p.id === planId) ?? MP_PLANS[1]

  const calc = (plan) => {
    const commission    = saleAmount * plan.rate
    const ivaOnComm     = commission * IVA_RATE
    const totalDeducted = commission + ivaOnComm
    const netReceived   = saleAmount - totalDeducted
    const effectiveRate = saleAmount > 0 ? (totalDeducted / saleAmount) * 100 : 0
    return { commission, ivaOnComm, totalDeducted, netReceived, effectiveRate }
  }

  const active = calc(activePlan)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#009ee3]/10 flex items-center justify-center text-base flex-shrink-0">
          💳
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Comisiones Mercado Pago</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Checkout Pro · Cuánto te queda neto por venta según el plazo de acreditación
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">
            Monto de venta a simular
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-semibold text-sm">$</span>
            <input
              type="number" min="0" step="1000"
              value={saleInput}
              onChange={e => setSaleInput(e.target.value)}
              className="w-44 px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold
                         focus:outline-none focus:ring-2 focus:ring-[#009ee3] text-right"
            />
            <span className="text-gray-400 text-sm">ARS</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Plazo de acreditación
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MP_PLANS.map(plan => {
              const c = calc(plan)
              return (
                <button
                  key={plan.id}
                  onClick={() => setPlanId(plan.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all
                    ${planId === plan.id ? 'border-[#009ee3] bg-[#009ee3]/5' : 'border-gray-200 hover:border-[#009ee3]/40'}`}
                >
                  <div className={`text-sm font-bold mb-0.5 ${planId === plan.id ? 'text-[#009ee3]' : 'text-gray-700'}`}>
                    {plan.label}
                  </div>
                  <div className="text-[11px] text-gray-400 mb-1">{plan.days}</div>
                  <div className={`text-xs font-semibold ${planId === plan.id ? 'text-[#009ee3]' : 'text-gray-500'}`}>
                    {(plan.rate * 100).toFixed(2)}% + IVA
                  </div>
                  {saleAmount > 0 && (
                    <div className="text-[11px] text-red-400 mt-1">−{fmtARS(c.totalDeducted)}</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {saleAmount > 0 && (
          <div className="bg-gray-50 rounded-xl overflow-hidden">
            <div className="px-5 py-4 space-y-2.5 text-sm border-b border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-500">Precio de venta</span>
                <span className="font-medium">{fmtARS(saleAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Comisión MP ({(activePlan.rate * 100).toFixed(2)}%)</span>
                <span className="text-red-500">−{fmtARS(active.commission)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">IVA sobre comisión (21%)</span>
                <span className="text-red-500">−{fmtARS(active.ivaOnComm)}</span>
              </div>
            </div>
            <div className="px-5 py-4 flex justify-between items-center">
              <div>
                <span className="text-sm font-semibold text-gray-800">Lo que te acreditan</span>
                <span className="ml-2 text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                  tasa efectiva {active.effectiveRate.toFixed(2)}%
                </span>
              </div>
              <span className="text-xl font-bold text-green-600">{fmtARS(active.netReceived)}</span>
            </div>
          </div>
        )}

        {saleAmount > 0 && (
          <div>
            <button onClick={() => setShowAll(v => !v)}
              className="text-sm text-[#009ee3] hover:text-[#0087c2] font-medium flex items-center gap-1">
              {showAll ? '▲ Ocultar' : '▼ Ver'} comparativa de todos los plazos
            </button>

            {showAll && (
              <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden text-sm">
                <div className="grid grid-cols-4 px-4 py-2.5 bg-gray-50 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <span>Plazo</span>
                  <span className="text-right">Comisión total</span>
                  <span className="text-right">Neto recibido</span>
                  <span className="text-right">Tasa efectiva</span>
                </div>
                {MP_PLANS.map(plan => {
                  const c        = calc(plan)
                  const isActive = plan.id === planId
                  return (
                    <button key={plan.id} onClick={() => setPlanId(plan.id)}
                      className={`w-full grid grid-cols-4 px-4 py-3 text-sm border-t border-gray-100 transition-colors text-left
                        ${isActive ? 'bg-[#009ee3]/5' : 'hover:bg-gray-50'}`}>
                      <span className={`font-medium ${isActive ? 'text-[#009ee3]' : 'text-gray-700'}`}>
                        {plan.label}
                      </span>
                      <span className="text-right text-red-400">−{fmtARS(c.totalDeducted)}</span>
                      <span className={`text-right font-semibold ${isActive ? 'text-green-600' : 'text-gray-700'}`}>
                        {fmtARS(c.netReceived)}
                      </span>
                      <span className="text-right text-gray-400">{c.effectiveRate.toFixed(2)}%</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          <span className="flex-shrink-0">⚠️</span>
          <span>
            Las tasas son orientativas para Checkout Pro en Argentina. Pueden variar según tu provincia
            (por Ingresos Brutos) y si ofrecés cuotas sin interés. Verificá en{' '}
            <a href="https://www.mercadopago.com.ar/costs-section" target="_blank" rel="noopener noreferrer"
              className="underline font-medium hover:text-amber-900">
              mercadopago.com.ar/costs-section
            </a>
          </span>
        </div>
      </div>
    </div>
  )
}
