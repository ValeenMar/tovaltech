// src/pages/Banners.jsx
// Admin: gestión del carrusel del inicio y video de YouTube.
// Dimensiones recomendadas para banners: 1440 x 500 px (ratio 2.88:1)

import { useState, useEffect, useCallback } from 'react'

const RECOMMENDED = '1440 × 500 px (ratio 16:5)'

// ── Hook ─────────────────────────────────────────────────────────────────────
function useBanners() {
  const [banners,    setBanners]    = useState([])
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/banners?admin=1')
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error')
      setBanners(data.banners || [])
      setYoutubeUrl(data.youtube_url || '')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { banners, youtubeUrl, loading, error, reload: load }
}

// ── Extrae ID de YouTube de cualquier formato de URL ──────────────────────────
function extractYoutubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// ── Modal: crear / editar banner ─────────────────────────────────────────────
function BannerModal({ banner, onClose, onSaved }) {
  const isEdit = !!banner
  const [imageUrl,  setImageUrl]  = useState(banner?.image_url  || '')
  const [title,     setTitle]     = useState(banner?.title      || '')
  const [subtitle,  setSubtitle]  = useState(banner?.subtitle   || '')
  const [linkUrl,   setLinkUrl]   = useState(banner?.link_url   || '')
  const [sortOrder, setSortOrder] = useState(banner?.sort_order ?? 0)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  const handleSave = async () => {
    if (!imageUrl.trim()) { setError('La URL de imagen es requerida.'); return }
    setSaving(true); setError(null)
    try {
      const body = isEdit
        ? { action: 'update', id: banner.id, image_url: imageUrl.trim(), title: title.trim() || null,
            subtitle: subtitle.trim() || null, link_url: linkUrl.trim() || null,
            sort_order: parseInt(sortOrder, 10) || 0 }
        : { action: 'create', image_url: imageUrl.trim(), title: title.trim() || null,
            subtitle: subtitle.trim() || null, link_url: linkUrl.trim() || null,
            sort_order: parseInt(sortOrder, 10) || 0 }
      const res = await fetch('/api/banners', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
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
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-1 text-base">
          {isEdit ? '✏️ Editar banner' : '➕ Nuevo banner'}
        </h3>
        <p className="text-xs text-gray-400 mb-5">
          Dimensiones recomendadas: <strong>{RECOMMENDED}</strong>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">URL de imagen *</label>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
              placeholder="https://tudominio.com/banner.jpg"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Preview */}
          {imageUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100 h-32">
              <img src={imageUrl} alt="preview"
                   className="w-full h-full object-cover"
                   onError={e => e.target.style.display='none'} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Título (opcional)</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Nuevos productos"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Orden</label>
              <input type="number" min="0" value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Subtítulo (opcional)</label>
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
              placeholder="Ej: Hasta 30% de descuento"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Link al hacer click (opcional)</label>
            <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              placeholder="Ej: /productos?categoria=Monitores"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mt-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !imageUrl.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold
                       hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agregar banner'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de banner ────────────────────────────────────────────────────────
function BannerCard({ banner, onEdit, onToggle, onDelete }) {
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleToggle = async () => {
    setToggling(true)
    try {
      await fetch('/api/banners', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: banner.id, active: !banner.active }),
      })
      onToggle()
    } catch { /* silencio */ } finally { setToggling(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar este banner?`)) return
    setDeleting(true)
    try {
      await fetch('/api/banners', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: banner.id }),
      })
      onDelete()
    } catch { /* silencio */ } finally { setDeleting(false) }
  }

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all
      ${banner.active ? 'border-gray-200' : 'border-red-200 opacity-60'}`}>
      {/* Imagen */}
      <div className="h-36 bg-gray-100 relative overflow-hidden">
        <img src={banner.image_url} alt={banner.title || 'Banner'}
             className="w-full h-full object-cover"
             onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
        <div className="w-full h-full items-center justify-center text-gray-300 text-4xl hidden">🖼️</div>
        {/* Badge orden */}
        <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          #{banner.sort_order}
        </span>
        {!banner.active && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-xs bg-red-500 text-white font-bold px-3 py-1 rounded-lg">🚫 Oculto</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-800 truncate">{banner.title || <span className="text-gray-300 italic">Sin título</span>}</p>
        {banner.subtitle && <p className="text-xs text-gray-400 truncate">{banner.subtitle}</p>}
        {banner.link_url && (
          <p className="text-[10px] text-blue-400 truncate mt-0.5">🔗 {banner.link_url}</p>
        )}
      </div>

      {/* Acciones */}
      <div className="px-3 pb-3 flex gap-2">
        <button onClick={handleToggle} disabled={toggling}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors
            ${banner.active
              ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
              : 'bg-red-50 text-red-600 border border-red-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'}`}>
          {toggling ? '…' : banner.active ? '👁 Visible' : '🚫 Oculto'}
        </button>
        <button onClick={() => onEdit(banner)}
          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:bg-gray-50">
          ✏️
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-200 hover:bg-red-50">
          {deleting ? '…' : '🗑️'}
        </button>
      </div>
    </div>
  )
}

// ── Panel YouTube ────────────────────────────────────────────────────────────
function YoutubePanel({ initialUrl, onSaved }) {
  const [url,    setUrl]    = useState(initialUrl || '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState(null)

  useEffect(() => { setUrl(initialUrl || '') }, [initialUrl])

  const ytId = extractYoutubeId(url)

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/banners', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set_youtube', youtube_url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">🎬 Video de YouTube en el inicio</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Se muestra debajo del carrusel, a pantalla completa, en loop silenciado.
          Dejá vacío para ocultarlo.
        </p>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="flex gap-3">
          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setSaved(false) }}
            placeholder="https://www.youtube.com/watch?v=xxxxxxxxxxx"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors
              ${saved
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'}`}>
            {saving ? 'Guardando...' : saved ? '✅ Guardado' : 'Guardar'}
          </button>
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        {ytId ? (
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-black aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=0&mute=1&loop=1&playlist=${ytId}&controls=1`}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Preview YouTube"
            />
          </div>
        ) : url ? (
          <p className="text-xs text-orange-500 bg-orange-50 px-3 py-2 rounded-lg">
            ⚠️ No se reconoce como URL de YouTube válida. Probá con el formato: youtube.com/watch?v=...
          </p>
        ) : null}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Banners() {
  const { banners, youtubeUrl, loading, error, reload } = useBanners()
  const [modal, setModal] = useState(null) // null | 'create' | banner object para edit

  const activeBanners  = banners.filter(b => b.active)
  const inactiveBanners = banners.filter(b => !b.active)

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-lg text-gray-800">
            🖼️ Contenido del Inicio
            <span className="ml-2 text-sm font-normal text-gray-400">
              {loading ? 'cargando...' : `${activeBanners.length} banners activos`}
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Carrusel de imágenes + video de YouTube que aparecen en la página principal de la tienda.
          </p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm
                     font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          ➕ Nuevo banner
        </button>
      </div>

      {/* ── Info dimensiones ────────────────────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5
                      flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-amber-700">
        <span className="font-semibold">📐 Dimensiones recomendadas para banners:</span>
        <span><strong>{RECOMMENDED}</strong></span>
        <span>Formatos: JPG, PNG, WebP · Peso máximo recomendado: 500 KB</span>
        <span>Los banners se muestran en orden ascendente por el número de orden.</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <div className="animate-spin text-3xl mr-3">⚙️</div> Cargando...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 mb-5">
          <strong>Error al cargar.</strong> {error}
          <br />
          <span className="text-xs text-red-400 mt-1 block">
            Puede que la tabla aún no exista. Corrá el SQL de creación desde Azure Portal.
          </span>
        </div>
      )}

      {/* ── Banners activos ─────────────────────────────────────────────── */}
      {!loading && (
        <>
          {banners.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16
                            text-center text-gray-400 text-sm mb-5">
              <p className="text-4xl mb-3">🖼️</p>
              <p className="font-medium">No hay banners todavía</p>
              <p className="text-xs mt-1 mb-4">Agregá imágenes para el carrusel del inicio.</p>
              <button onClick={() => setModal('create')}
                className="text-blue-600 hover:underline text-sm">
                ➕ Agregar primer banner
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              {banners.map(b => (
                <BannerCard
                  key={b.id}
                  banner={b}
                  onEdit={setModal}
                  onToggle={reload}
                  onDelete={reload}
                />
              ))}
            </div>
          )}

          {/* ── Panel YouTube ──────────────────────────────────────────── */}
          <YoutubePanel initialUrl={youtubeUrl} onSaved={reload} />
        </>
      )}

      {/* ── Modales ─────────────────────────────────────────────────────── */}
      {modal === 'create' && (
        <BannerModal
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload() }}
        />
      )}
      {modal && modal !== 'create' && (
        <BannerModal
          banner={modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload() }}
        />
      )}
    </>
  )
}
