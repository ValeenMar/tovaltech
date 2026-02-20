// src/pages/store/Home.jsx
import { useState, useEffect } from 'react'
import { useSEO } from '../../hooks/useSEO'
import { Link } from 'react-router-dom'
import HeroSection from '../../components/store/HeroSection'
import ProductCard from '../../components/store/ProductCard'
import { useProducts } from '../../hooks/useProducts'

const FEATURES = [
  { icon: '🚚', title: 'Envío Gratis',   desc: 'En compras mayores a $50.000' },
  { icon: '🔒', title: 'Pago Seguro',    desc: 'Transacciones protegidas' },
  { icon: '🔄', title: 'Devoluciones',   desc: '30 días para devolver' },
  { icon: '💬', title: 'Soporte 24/7',   desc: 'Siempre disponibles' },
]

// Extrae el video ID de cualquier formato de URL de YouTube
function extractYoutubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// ── Sección YouTube: thumbnail con click-to-play ──────────────────────────────
// Solución al problema del iframe bloqueado:
//   1. Se muestra la thumbnail de YouTube (sin ningún iframe)
//   2. El usuario hace click → se monta el iframe con autoplay=1
// Así se respeta la política del navegador: autoplay solo ocurre por gesto humano.
function YoutubeSection({ videoId }) {
  const [playing, setPlaying] = useState(false)
  const thumb = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

  if (!playing) {
    return (
      <section
        className="w-full bg-black relative cursor-pointer group"
        style={{ aspectRatio: '16 / 9' }}
        onClick={() => setPlaying(true)}
        role="button"
        aria-label="Reproducir video"
      >
        {/* Thumbnail de YouTube */}
        <img
          src={thumb}
          alt="Video TovalTech"
          className="w-full h-full object-cover"
        />
        {/* Overlay oscuro al hover */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
        {/* Botón play estilo YouTube */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl
                          group-hover:scale-110 transition-transform duration-200">
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {/* Hint de texto */}
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm
                      bg-black/40 px-4 py-1 rounded-full backdrop-blur-sm">
          Hacé click para reproducir
        </p>
      </section>
    )
  }

  // Después del click → iframe en youtube-nocookie.com con autoplay
  return (
    <section className="w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1`}
        className="w-full h-full"
        style={{ display: 'block' }}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        title="TovalTech Video"
      />
    </section>
  )
}

export default function Home() {
  const { products, loading } = useProducts({ limit: 8 })
  useSEO({ title: 'Inicio', description: 'TovalTech — Tienda de tecnología y computación. Procesadores, placas de video, memorias RAM, almacenamiento, periféricos y más. Envíos a todo el país.' })
  const [youtubeId, setYoutubeId] = useState(null)

  // Cargar YouTube URL desde la API de banners (misma llamada que el hero)
  useEffect(() => {
    fetch('/api/banners')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.youtube_url) setYoutubeId(extractYoutubeId(d.youtube_url))
      })
      .catch(() => {})
  }, [])

  // Destacados: primero featured=true, máximo 4. Si no alcanza, completa con los primeros.
  const featured = products.filter(p => p.featured === true || p.featured === 1).slice(0, 4)
  const display  = featured.length >= 1 ? featured : products.slice(0, 4)

  return (
    <div>
      {/* ── Carrusel / Hero ─────────────────────────────────────────── */}
      <HeroSection />

      {/* ── Beneficios ───────────────────────────────────────────────── */}
      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-3xl">{f.icon}</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Video YouTube (click-to-play) ─────────────────────────────── */}
      {youtubeId && <YoutubeSection videoId={youtubeId} />}

      {/* ── Productos Destacados ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Productos Destacados</h2>
            <p className="text-gray-500 mt-1">Lo más popular de nuestra tienda</p>
          </div>
          <Link to="/productos" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            Ver todos →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 h-72 animate-pulse">
                <div className="bg-gray-100 h-48 rounded-t-xl" />
                <div className="p-4 space-y-2">
                  <div className="bg-gray-100 h-3 rounded w-3/4" />
                  <div className="bg-gray-100 h-3 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {display.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">¿Necesitás algo especial?</h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Contactanos y te ayudamos a encontrar exactamente lo que buscás.
          </p>
          <Link to="/contacto"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold
                       hover:bg-blue-700 transition-colors">
            Contactar Ahora
          </Link>
        </div>
      </section>
    </div>
  )
}

