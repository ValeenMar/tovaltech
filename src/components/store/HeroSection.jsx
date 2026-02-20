// src/components/store/HeroSection.jsx
// Carrusel de banners gestionado desde el admin.
// - Dimensiones: configurables desde admin (banner_width x banner_height)
// - Si no hay banners activos → muestra el hero estático original.

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const INTERVAL = 5000 // ms entre slides

// ── Hero estático (fallback sin banners) ──────────────────────────────────────
function DefaultHero() {
  return (
    <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 text-8xl">⚡</div>
        <div className="absolute top-32 right-20 text-6xl">💻</div>
        <div className="absolute bottom-20 left-1/3 text-7xl">🎧</div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative">
        <div className="max-w-2xl">
          <span className="inline-block bg-white/20 backdrop-blur-sm text-sm font-medium px-4 py-1 rounded-full mb-6">
            🚀 Nuevos productos disponibles
          </span>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Tecnología que <span className="text-yellow-300">impulsa</span> tu día
          </h1>
          <p className="text-lg md:text-xl text-blue-100 mb-8">
            Descubrí los mejores productos tech con envío rápido, garantía extendida y los mejores precios.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/productos" className="bg-white text-blue-700 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-all shadow-lg">
              Ver Productos
            </Link>
            <Link to="/contacto" className="border-2 border-white/30 px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-all">
              Contactanos
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Carrusel ──────────────────────────────────────────────────────────────────
function Carousel({ banners, width, height }) {
  const [current, setCurrent] = useState(0)
  const [paused,  setPaused]  = useState(false)
  const total = banners.length

  const goTo = (idx) => setCurrent((idx + total) % total)
  const prev = () => goTo(current - 1)
  const next = () => goTo(current + 1)

  // Auto-avance
  useEffect(() => {
    if (total <= 1 || paused) return
    const t = setInterval(() => setCurrent(c => (c + 1) % total), INTERVAL)
    return () => clearInterval(t)
  }, [total, paused, current])

  const ratio = `${width} / ${height}`

  return (
    <section
      className="relative w-full overflow-hidden select-none"
      style={{ aspectRatio: ratio, maxHeight: `${height}px` }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {banners.map((b, i) => (
        <div
          key={b.id}
          className={`absolute inset-0 transition-opacity duration-700
            ${i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
          {b.link_url ? (
            <a href={b.link_url} {...(b.link_url.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
               className="block w-full h-full">
              <img src={b.image_url} alt={b.title || `Banner ${i + 1}`}
                   className="w-full h-full object-cover" draggable={false} />
            </a>
          ) : (
            <img src={b.image_url} alt={b.title || `Banner ${i + 1}`}
                 className="w-full h-full object-cover" draggable={false} />
          )}

          {/* Texto superpuesto */}
          {(b.title || b.subtitle) && (
            <div className="absolute inset-0 flex items-end justify-start z-20 pointer-events-none
                            bg-gradient-to-t from-black/50 via-transparent to-transparent">
              <div className="px-8 py-8 text-white max-w-2xl">
                {b.title    && <h2 className="text-2xl md:text-4xl font-bold drop-shadow-lg mb-2">{b.title}</h2>}
                {b.subtitle && <p  className="text-sm md:text-lg text-white/90 drop-shadow">{b.subtitle}</p>}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Flechas */}
      {total > 1 && (
        <>
          <button onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30
                       w-10 h-10 bg-black/30 hover:bg-black/50 text-white rounded-full
                       flex items-center justify-center transition-colors backdrop-blur-sm text-xl"
            aria-label="Anterior">‹</button>
          <button onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30
                       w-10 h-10 bg-black/30 hover:bg-black/50 text-white rounded-full
                       flex items-center justify-center transition-colors backdrop-blur-sm text-xl"
            aria-label="Siguiente">›</button>
        </>
      )}

      {/* Dots */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all
                ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`}
              aria-label={`Ir al slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Export principal ──────────────────────────────────────────────────────────
export default function HeroSection() {
  const [banners,      setBanners]      = useState(null) // null = cargando
  const [bannerWidth,  setBannerWidth]  = useState(1440)
  const [bannerHeight, setBannerHeight] = useState(500)

  useEffect(() => {
    fetch('/api/banners')
      .then(r => r.ok ? r.json() : { banners: [] })
      .then(d => {
        setBanners(d.banners || [])
        if (d.banner_width)  setBannerWidth(d.banner_width)
        if (d.banner_height) setBannerHeight(d.banner_height)
      })
      .catch(() => setBanners([]))
  }, [])

  // Mientras carga → hero estático (evita layout shift)
  if (banners === null || banners.length === 0) return <DefaultHero />
  return <Carousel banners={banners} width={bannerWidth} height={bannerHeight} />
}

