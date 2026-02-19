import { memo, useState } from 'react';
import { useCart } from '../../context/CartContext';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtUSD = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n ?? 0);

function ProductCard({ product, priority = false }) {
  const { addToCart } = useCart();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleAdd = () => {
    addToCart({
      id:        product.id,
      name:      product.name,
      category:  product.category,
      emoji:     product.emoji ?? '📦',
      image_url: product.image_url ?? null,
      price:     product.price_ars,
      price_usd: product.price_usd,
    });
  };

  const showImage = product.image_url && !imgError;
  const dolarRate = product.dolar_rate;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden group flex flex-col">
      {/* Imagen / Emoji — height fija evita CLS */}
      <div className="bg-white h-52 flex items-center justify-center overflow-hidden relative flex-shrink-0 border-b border-gray-100">
        {showImage ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-gray-100 animate-pulse" />
            )}
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
              className={`max-h-full max-w-full w-auto h-auto object-contain transition-opacity duration-300
                group-hover:scale-105 transition-transform p-3
                ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </>
        ) : (
          <span className="text-6xl select-none">{product.emoji ?? '📦'}</span>
        )}

        {/* Badge featured */}
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

        {/* Precios */}
        <div className="flex items-end justify-between mt-auto pt-2 border-t border-gray-50">
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-lg font-bold text-gray-900 leading-tight">{fmtARS(product.price_ars)}</p>
              <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded">
                IVA inc.
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmtUSD(product.price_usd)} · Precio final
            </p>
          </div>
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium
                       hover:bg-blue-700 active:scale-95 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ml-2"
          >
            🛒 Agregar
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
    </div>
  );
}

// React.memo: evita re-render si el producto no cambió
export default memo(ProductCard);
