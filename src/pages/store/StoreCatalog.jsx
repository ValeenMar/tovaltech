import { useState, useCallback } from 'react';
import ProductCard from '../../components/store/ProductCard';
import { useProducts } from '../../hooks/useProducts';
import { useProductsMeta } from '../../hooks/useProductsMeta';

const SORT_OPTIONS = [
  { value: 'default',     label: 'Ordenar por' },
  { value: 'price-asc',   label: 'Precio: menor a mayor' },
  { value: 'price-desc',  label: 'Precio: mayor a menor' },
  { value: 'rating',      label: 'Mejor valorados' },
  { value: 'name',        label: 'Nombre A→Z' },
];

const PAGE_SIZE = 24;

export default function StoreCatalog() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm]         = useState('');
  const [inputValue, setInputValue]         = useState('');
  const [sortBy, setSortBy]                 = useState('default');
  const [page, setPage]                     = useState(0);

  const { categories } = useProductsMeta();

  const { products, total, loading, error } = useProducts({
    categoria: activeCategory !== 'Todos' ? activeCategory : '',
    buscar:    searchTerm,
    limit:     PAGE_SIZE,
    offset:    page * PAGE_SIZE,
  });

  // Ordenamiento client-side sobre la página actual
  const sorted = [...products].sort((a, b) => {
    if (sortBy === 'price-asc')  return a.price_ars - b.price_ars;
    if (sortBy === 'price-desc') return b.price_ars - a.price_ars;
    if (sortBy === 'rating')     return (b.rating ?? 0) - (a.rating ?? 0);
    if (sortBy === 'name')       return a.name.localeCompare(b.name, 'es');
    // default: featured primero
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Buscar con debounce manual: sólo dispara al presionar Enter o perder foco
  const handleSearch = useCallback((val) => {
    setSearchTerm(val);
    setPage(0);
  }, []);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setPage(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Nuestros Productos</h1>
        <p className="text-gray-500 mt-1">
          {loading ? 'Cargando...' : `${total.toLocaleString('es-AR')} productos disponibles`}
        </p>
      </div>

      {/* Barra de filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o marca..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch(inputValue)}
          onBlur={() => handleSearch(inputValue)}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Categorías dinámicas */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize
              ${activeCategory === cat
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'}`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Estado: loading */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-500">Cargando productos...</p>
        </div>
      )}

      {/* Estado: error real (no se usa si el fallback funciona) */}
      {error && !loading && (
        <div className="text-center py-16 text-red-500">
          <span className="text-5xl mb-4 block">⚠️</span>
          <p>Error al cargar: {error}</p>
        </div>
      )}

      {/* Productos */}
      {!loading && !error && (
        <>
          {sorted.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sorted.map(p => <ProductCard key={p.id} product={p} />)}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium
                               hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Anterior
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      // Mostrar páginas alrededor de la actual
                      let p;
                      if (totalPages <= 7) {
                        p = i;
                      } else if (page < 4) {
                        p = i < 5 ? i : i === 5 ? -1 : totalPages - 1;
                      } else if (page > totalPages - 5) {
                        p = i === 0 ? 0 : i === 1 ? -1 : totalPages - (6 - i);
                      } else {
                        p = i === 0 ? 0 : i === 1 ? -1 : i === 5 ? -1 : i === 6 ? totalPages - 1 : page + i - 3;
                      }
                      if (p === -1) return <span key={i} className="px-2 py-2 text-gray-400">…</span>;
                      return (
                        <button
                          key={i}
                          onClick={() => setPage(p)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
                            ${page === p ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}
                        >
                          {p + 1}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium
                               hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente →
                  </button>
                </div>
              )}

              <p className="text-center text-xs text-gray-400 mt-4">
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString('es-AR')} productos
              </p>
            </>
          ) : (
            <div className="text-center py-16">
              <span className="text-6xl mb-4 block">🔍</span>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No se encontraron productos</h3>
              <p className="text-gray-500">Probá con otra búsqueda o categoría</p>
              <button
                onClick={() => { setActiveCategory('Todos'); setSearchTerm(''); setInputValue(''); setPage(0); }}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Ver todos los productos
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
