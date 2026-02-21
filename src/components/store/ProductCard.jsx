// src/components/store/ProductCard.jsx
// Tarjeta de producto — ahora con link a la página de detalle

import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtUSD = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n ?? 0);

function ProductCard({ product, priority = false }) {
  const { addToCart } = useCart();
  const [imgError,  setImgError]  = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [added,     setAdded]     = useState(false);

  const handleAdd = (e) => {
    e.preventDefault(); // no navega al detalle al clickear el botón
    addToCart({
      id:        product.id,
      name:      product.name,
      category:  product.category,
      emoji:     product.emoji ?? '📦',
      image_url: product.image_url ?? null,
      price:     product.price_ars,
      price_usd: product.price_usd,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const showImage = product.image_url && !imgError;

  return (
    <Link
      to={`/productos/${product.id}`}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden group flex flex-col"
    >
      {/* Imagen */}
      <div className="bg-white h-52 flex items-center justify-center overflow-hidden relative flex-shrink-0 border-b border-gray-100">
        {showImage ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 bg-gray-100 animate-pulse" />}
            <img
              src={product.image_url}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              fetchpriority={priority ? 'high' : 'auto'}
              decoding="async"
              width={240}
              height={208}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`max-h-full max-w-full w-auto h-auto object-contain p-3
                group-hover:scale-105 transition-transform duration-300
                ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </>
        ) : (
          <span className="text-6xl select-none">{product.emoji ?? '📦'}</span>
        )}

        {product.featured && (
          <span className="absolute top-2 left-2 text-[10px] bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full shadow-sm">
            ⭐ Destacado
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
            <p className="text-[11px] text-gray-400 mt-0.5">Precio sin imp. nacionales: {fmtARS(Math.round(product.price_ars / 1.21))}</p>
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
          <p className="text-[11px] text-orange-500 mt-1.5">⚠️ Solo {product.stock} unidad{product.stock !== 1 ? 'es' : ''}</p>
        )}
        {product.stock === 0 && (
          <p className="text-[11px] text-red-500 mt-1.5">❌ Sin stock</p>
        )}
      </div>
    </Link>
  );
}

export default memo(ProductCard);
