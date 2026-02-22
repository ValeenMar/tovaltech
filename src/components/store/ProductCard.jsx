// src/components/store/ProductCard.jsx
// Tarjeta de producto con lazy loading real via IntersectionObserver.
// Las imágenes se cargan SOLO cuando la card entra al viewport, no antes.

import { memo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0);

// ── Hook: carga la imagen solo cuando es visible en pantalla ──────────────────
// priority=true → src se asigna inmediatamente + fetchpriority=high (LCP)
// priority=false → IntersectionObserver real, src se asigna al entrar al viewport
function useLazyImage(src, priority = false) {
  const ref          = useRef(null);
  const [ready, setReady]   = useState(priority);
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState(false);

  useEffect(() => {
    // Las imágenes prioritarias ya están ready desde el inicio
    if (priority) return;
    if (!src) return;

    const el = ref.current;
    if (!el) return;

    // Si IntersectionObserver no está disponible (SSR/viejo browser) → cargar igual
    if (typeof IntersectionObserver === 'undefined') {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }  // empieza a cargar 300px antes de ser visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [src, priority]);

  return { ref, ready, loaded, error, setLoaded, setError };
}

function ProductCard({ product, priority = false }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const { ref, ready, loaded, error, setLoaded, setError } = useLazyImage(
    product.image_url,
    priority
  );

  const handleAdd = (e) => {
    e.preventDefault();
    addToCart({
      id:        product.id,
      name:      product.name,
      category:  product.category,
      emoji:     product.emoji ?? '📦',
      image_url: product.image_url ?? null,
      price:     product.price_ars,
      price_usd: product.price_usd,
      stock:     product.stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const showImage = product.image_url && !error;

  return (
    <Link
      to={`/productos/${product.id}`}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden group flex flex-col"
    >
      {/* Imagen */}
      <div
        ref={ref}
        className="bg-white h-52 flex items-center justify-center overflow-hidden relative flex-shrink-0 border-b border-gray-100"
      >
        {showImage ? (
          <>
            {/* Skeleton mientras no carga */}
            {!loaded && <div className="absolute inset-0 bg-gray-100 animate-pulse" />}

            {/* Solo pone el src cuando la card es visible */}
            {ready && (
              <img
                src={product.image_url}
                alt={product.name}
                decoding="async"
                fetchpriority={priority ? 'high' : 'auto'}
                width={240}
                height={208}
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
                className={`max-h-full max-w-full w-auto h-auto object-contain p-3
                  group-hover:scale-105 transition-transform duration-300
                  ${loaded ? 'opacity-100' : 'opacity-0'}`}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-gray-300">
            <svg viewBox="0 0 24 24" className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
            </svg>
            <span className="text-xs text-gray-300">Sin imagen</span>
          </div>
        )}

        {product.featured && (
          <span className="absolute top-2 left-2 text-[10px] bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full shadow-sm">
            ★ Destacado
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        {/* Categoría + Marca */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded truncate max-w-[60%] capitalize">
            {(product.category ?? '').toLowerCase()}
          </span>
          {product.brand && (
            <span className="text-[11px] text-gray-400 truncate ml-1">{product.brand}</span>
          )}
        </div>

        {/* Nombre */}
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 flex-1">
          {product.name}
        </h3>

        {/* Garantía */}
        {product.warranty && product.warranty !== '-' && product.warranty !== '9999' && (
          <p className="text-[11px] text-gray-400 mb-2">🛡️ Garantía: {product.warranty}</p>
        )}

        {/* Precios + botón */}
        <div className="flex items-end justify-between mt-auto pt-2 border-t border-gray-50">
          <div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{fmtARS(product.price_ars)}</p>
          </div>

          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 ml-2
              active:scale-95 transition-all
              ${added
                ? 'bg-green-500 text-white'
                : product.stock === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {added ? '✅' : '🛒 Agregar'}
          </button>
        </div>

        {/* Stock bajo */}
        {product.stock > 0 && product.stock <= 5 && (
          <p className="text-[11px] text-orange-500 mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"></span>
            Solo {product.stock} unidad{product.stock !== 1 ? 'es' : ''} disponible{product.stock !== 1 ? 's' : ''}
          </p>
        )}
        {product.stock === 0 && (
          <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"></span>
            Sin stock
          </p>
        )}
      </div>
    </Link>
  );
}

export default memo(ProductCard);
