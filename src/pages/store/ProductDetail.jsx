// src/pages/store/ProductDetail.jsx
// Página de detalle de producto — /productos/:id

import { useState, useEffect, useRef } from 'react';
import { useSEO } from '../../hooks/useSEO';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import ProductCard from '../../components/store/ProductCard';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0);

// ── Carrusel de productos similares ──────────────────────────────────────────
// Muestra 4 cards por vez en desktop, 2 en mobile.
// Flechas ‹ › para navegar, drag/swipe con el mouse o touch.
function SimilarCarousel({ products, category }) {
  const VISIBLE_LG = 4
  const VISIBLE_SM = 2
  const [startIndex, setStartIndex] = useState(0)
  const trackRef   = useRef(null)
  const dragStart  = useRef(null)

  // Cuántos items mostrar según el ancho de pantalla
  const visible = () => (window.innerWidth >= 640 ? VISIBLE_LG : VISIBLE_SM)

  const maxIndex = Math.max(0, products.length - visible())

  const prev = () => setStartIndex(i => Math.max(0, i - 1))
  const next = () => setStartIndex(i => Math.min(maxIndex, i + 1))

  // Drag / swipe
  const onPointerDown = (e) => {
    dragStart.current = e.clientX ?? e.touches?.[0]?.clientX
  }
  const onPointerUp = (e) => {
    if (dragStart.current == null) return
    const end  = e.clientX ?? e.changedTouches?.[0]?.clientX ?? dragStart.current
    const diff = dragStart.current - end
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev()
    dragStart.current = null
  }

  const canPrev = startIndex > 0
  const canNext = startIndex < maxIndex

  // Cuántas páginas hay (para los dots)
  const vis      = typeof window !== 'undefined' ? (window.innerWidth >= 640 ? VISIBLE_LG : VISIBLE_SM) : VISIBLE_LG
  const pageCount = Math.ceil(products.length / vis)
  const currentPage = Math.floor(startIndex / vis)

  return (
    <div className="mt-14">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Productos similares</h2>
          <p className="text-sm text-gray-400 capitalize">{category?.toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/productos?categoria=${encodeURIComponent(category)}`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium mr-2"
          >
            Ver todos →
          </Link>
          {/* Flechas desktop */}
          <button
            onClick={prev} disabled={!canPrev}
            className={`w-9 h-9 rounded-full border flex items-center justify-center text-lg transition-all
              ${canPrev
                ? 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
                : 'border-gray-100 text-gray-300 cursor-default'}`}
            aria-label="Anterior"
          >‹</button>
          <button
            onClick={next} disabled={!canNext}
            className={`w-9 h-9 rounded-full border flex items-center justify-center text-lg transition-all
              ${canNext
                ? 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
                : 'border-gray-100 text-gray-300 cursor-default'}`}
            aria-label="Siguiente"
          >›</button>
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onPointerDown}
        onMouseUp={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchEnd={onPointerUp}
      >
        <div
          className="flex gap-4 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(calc(-${startIndex} * (100% / ${VISIBLE_LG} + 1px)))` }}
        >
          {products.map(p => (
            <div
              key={p.id}
              className="flex-none w-[calc(25%-12px)] sm:w-[calc(25%-12px)] max-sm:w-[calc(50%-8px)]"
              style={{ pointerEvents: 'auto' }}
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      {pageCount > 1 && (
        <div className="flex justify-center gap-1.5 mt-5">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStartIndex(i * vis)}
              className={`rounded-full transition-all
                ${i === currentPage
                  ? 'w-5 h-2 bg-blue-600'
                  : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'}`}
              aria-label={`Página ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductDetail() {
  const { id }        = useParams();
  const navigate      = useNavigate();
  const { addToCart } = useCart();

  const [product,  setProduct]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [imgError, setImgError] = useState(false);
  const [added,    setAdded]    = useState(false);
  const [similar,  setSimilar]  = useState([]);

  // SEO — siempre antes de cualquier return condicional (regla de hooks)
  useSEO({
    title:       product?.name,
    description: product
      ? `${product.name}${product.brand ? ' - ' + product.brand : ''}. ${product.category ? 'Categoría: ' + product.category + '.' : ''} Comprá online con envío a todo el país.`
      : undefined,
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setImgError(false);
    setSimilar([]);
    fetch(`/api/product?id=${id}`)
      .then(r => {
        if (r.status === 404) throw new Error('not_found');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(p => {
        setProduct(p);
        setLoading(false);
        // Cargar similares de la misma categoría
        if (p.category) {
          fetch(`/api/products?categoria=${encodeURIComponent(p.category)}&limit=13`)
            .then(r => r.ok ? r.json() : { items: [] })
            .then(d => {
              setSimilar((d.items || []).filter(x => String(x.id) !== String(p.id)).slice(0, 12));
            })
            .catch(() => {});
        }
      })
      .catch(err => {
        if (err.message === 'not_found') navigate('/productos', { replace: true });
        else { setError(err.message); setLoading(false); }
      });
  }, [id, navigate]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      id:        product.id,
      name:      product.name,
      category:  product.category,
      image_url: product.image_url ?? null,
      price:     product.price_ars,
      price_usd: product.price_usd,
      stock:     product.stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-gray-100 rounded-2xl h-80" />
        <div className="space-y-4">
          <div className="bg-gray-100 h-4 rounded w-1/3" />
          <div className="bg-gray-100 h-6 rounded w-full" />
          <div className="bg-gray-100 h-6 rounded w-3/4" />
          <div className="bg-gray-100 h-10 rounded w-1/2 mt-6" />
          <div className="bg-gray-100 h-12 rounded mt-4" />
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-center">
      <p className="text-red-500 mb-4">No se pudo cargar el producto.</p>
      <Link to="/productos" className="text-blue-600 hover:underline">← Volver al catálogo</Link>
    </div>
  );

  if (!product) return null;

  const showImage = product.image_url && !imgError;
  const inStock   = product.stock > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-blue-600">Inicio</Link>
        <span>›</span>
        <Link to="/productos" className="hover:text-blue-600">Productos</Link>
        <span>›</span>
        {product.category && (
          <>
            <Link to={`/productos?categoria=${product.category}`} className="hover:text-blue-600 capitalize">
              {product.category.toLowerCase()}
            </Link>
            <span>›</span>
          </>
        )}
        <span className="text-gray-600 truncate max-w-[200px]">{product.name}</span>
      </nav>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">

        {/* Imagen */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center p-8 min-h-[280px]">
          {showImage ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="max-h-72 max-w-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-8xl select-none">📦</span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">

          {/* Categoría + Marca — SIN proveedor (solo visible en admin) */}
          <div className="flex items-center gap-2 mb-3">
            {product.category && (
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full capitalize">
                {product.category.toLowerCase()}
              </span>
            )}
            {product.brand && (
              <span className="text-xs text-gray-400 font-medium">{product.brand}</span>
            )}
          </div>

          {/* Nombre */}
          <h1 className="text-xl font-bold text-gray-900 mb-2 leading-snug">
            {product.name}
          </h1>

          {/* SKU */}
          {product.sku && (
            <p className="text-xs text-gray-400 mb-4">SKU: {product.sku}</p>
          )}

          {/* Garantía */}
          {product.warranty && product.warranty !== '-' && product.warranty !== '9999' && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 mb-4 text-sm text-green-700">
              <span>🛡 Garantía: <strong>{product.warranty}</strong></span>
            </div>
          )}

          {/* Precios */}
          <div className="bg-gray-50 rounded-2xl px-5 py-4 mb-5">
            <p className="text-3xl font-bold text-gray-900 mb-1">{fmtARS(product.price_ars)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Precio sin impuestos nacionales: {fmtARS(product.price_ars)}
            </p>
            {product.dolar_rate && (
              <p className="text-xs text-gray-400 mt-1">
                Tipo de cambio: 1 USD = ${product.dolar_rate.toLocaleString('es-AR')} ARS (dólar oficial)
              </p>
            )}
          </div>

          {/* Stock */}
          <div className="mb-5">
            {!inStock ? (
              <span className="inline-flex items-center gap-2 text-sm text-red-600 font-medium bg-red-50 px-3 py-1.5 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Sin stock disponible
              </span>
            ) : product.stock <= 5 ? (
              <span className="inline-flex items-center gap-2 text-sm text-orange-600 font-medium bg-orange-50 px-3 py-1.5 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                Solo {product.stock} unidad{product.stock !== 1 ? 'es' : ''} disponible{product.stock !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm text-green-700 font-medium bg-green-50 px-3 py-1.5 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                En stock
              </span>
            )}
          </div>

          {/* Botones */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all
                ${added
                  ? 'bg-green-500 text-white'
                  : inStock
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              {added ? '✅ ¡Agregado al carrito!' : '🛒 Agregar al carrito'}
            </button>

            <Link
              to="/carrito"
              className="w-full py-3 rounded-xl bg-gray-800 text-white text-sm font-semibold
                         hover:bg-gray-700 active:scale-[0.98] transition-all text-center"
            >
              🛒 Ver carrito
            </Link>
          </div>

          {/* Info adicional */}
          <div className="mt-5 pt-5 border-t border-gray-100 space-y-2 text-xs text-gray-400">
            <p>📦 Retiro en tienda o envío a todo el país</p>
            <p>
              💳 Pagá con MercadoPago o consultá por{' '}
              <a href="https://wa.me/5491123413674" target="_blank" rel="noopener noreferrer"
                 className="text-green-600 hover:underline font-medium">WhatsApp</a>
              {' '}o{' '}
              <a href="mailto:valentin@toval-tech.com"
                 className="text-blue-500 hover:underline font-medium">mail</a>
            </p>
          </div>
        </div>
      </div>


      {/* Descripcion / Ficha tecnica */}
      {product.description && (
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-800 text-base">Descripcion del producto</h2>
          </div>
          <div className="px-6 py-5">
            <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">
              {product.description}
            </pre>
          </div>
        </div>
      )}

      {/* ── Productos similares ────────────────────────────────────────────── */}
      {similar.length > 0 && (
        <SimilarCarousel
          products={similar}
          category={product.category}
        />
      )}

      {/* Volver al catálogo */}
      <div className="mt-10">
        <Link
          to="/productos"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Volver al catálogo
        </Link>
      </div>
    </div>
  );
}
