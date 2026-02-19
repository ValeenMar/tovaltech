import { useState, useMemo, useCallback, memo } from 'react';
import ProductCard from '../../components/store/ProductCard';
import { useProducts } from '../../hooks/useProducts';
import { useProductsMeta } from '../../hooks/useProductsMeta';

const SORT_OPTIONS = [
  { value: 'default',    label: 'Relevancia' },
  { value: 'price-asc',  label: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Precio: mayor a menor' },
  { value: 'name',       label: 'Nombre A→Z' },
];

const PAGE_SIZE = 24;

// ── Categorías con colapso ────────────────────────────────────────────────────
const CategoryPills = memo(({ categories, active, onChange }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? categories : categories.slice(0, 10);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        {visible.map(cat => (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize whitespace-nowrap
              ${active === cat
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
          </button>
        ))}
        {categories.length > 10 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all"
          >
            {expanded ? '↑ Ver menos' : `+ ${categories.length - 10} más`}
          </button>
        )}
      </div>
    </div>
  );
});
CategoryPills.displayName = 'CategoryPills';

// ── Paginación ────────────────────────────────────────────────────────────────
const Pagination = memo(({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;

  const pages = useMemo(() => {
    const arr = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) arr.push(i);
    } else {
      arr.push(0);
      if (page > 2) arr.push(-1); // ellipsis
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) arr.push(i);
      if (page < totalPages - 3) arr.push(-1); // ellipsis
      arr.push(totalPages - 1);
    }
    return arr;
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-center gap-1.5 mt-10">
      <button
        onClick={() => onChange(p => Math.max(0, p - 1))}
        disabled={page === 0}
        className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >← Anterior</button>

      {pages.map((p, i) =>
        p === -1
          ? <span key={`e${i}`} className="px-2 text-gray-400 text-sm">…</span>
          : <button
              key={p}
              onClick={() => onChange(() => p)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
                ${page === p ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}
            >{p + 1}</button>
      )}

      <button
        onClick={() => onChange(p => Math.min(totalPages - 1, p + 1))}
        disabled={page >= totalPages - 1}
        className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >Siguiente →</button>
    </div>
  );
});
Pagination.displayName = 'Pagination';

// ── Skeleton grid ─────────────────────────────────────────────────────────────
const SkeletonGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {[...Array(PAGE_SIZE)].map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
        <div className="bg-gray-100 h-44" />
        <div className="p-4 space-y-2">
          <div className="bg-gray-100 h-3 rounded w-1/3" />
          <div className="bg-gray-100 h-3 rounded w-full" />
          <div className="bg-gray-100 h-3 rounded w-3/4" />
          <div className="bg-gray-100 h-8 rounded mt-4" />
        </div>
      </div>
    ))}
  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────
export default function StoreCatalog() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm]         = useState('');
  const [inputValue, setInputValue]         = useState('');
  const [sortBy, setSortBy]                 = useState('default');
  const [page, setPage]                     = useState(0);

  const { categories } = useProductsMeta();

  const filters = useMemo(() => ({
    categoria: activeCategory !== 'Todos' ? activeCategory : '',
    buscar:    searchTerm,
    limit:     PAGE_SIZE,
    offset:    page * PAGE_SIZE,
  }), [activeCategory, searchTerm, page]);

  const { products, total, loading } = useProducts(filters);

  const sorted = useMemo(() => {
    const arr = [...products];
    if (sortBy === 'price-asc')  arr.sort((a, b) => a.price_ars - b.price_ars);
    if (sortBy === 'price-desc') arr.sort((a, b) => b.price_ars - a.price_ars);
    if (sortBy === 'name')       arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return arr;
  }, [products, sortBy]);

  const totalPages = useMemo(() => Math.ceil(total / PAGE_SIZE), [total]);

  // Extraer dolar_rate del primer producto (todos tienen el mismo)
  const dolarRate = products[0]?.dolar_rate;

  const handleSearch = useCallback((val) => {
    setSearchTerm(val);
    setPage(0);
  }, []);

  const handleCategoryChange = useCallback((cat) => {
    setActiveCategory(cat);
    setPage(0);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Nuestros Productos</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {loading
              ? 'Cargando...'
              : `${total.toLocaleString('es-AR')} producto${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        {/* Indicador tipo de cambio */}
        {dolarRate && (
          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
            <span className="text-blue-500">💵</span>
            <span className="text-gray-600">1 USD</span>
            <span className="text-gray-400">=</span>
            <span className="font-semibold text-gray-800">
              ${dolarRate.toLocaleString('es-AR')} ARS
            </span>
            <span className="text-gray-400 text-xs">(oficial)</span>
          </div>
        )}
      </div>

      {/* Barra de búsqueda + orden */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o marca..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch(inputValue)}
          onBlur={() => inputValue !== searchTerm && handleSearch(inputValue)}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={sortBy}
          onChange={e => { setSortBy(e.target.value); setPage(0); }}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Categorías */}
      <CategoryPills
        categories={categories}
        active={activeCategory}
        onChange={handleCategoryChange}
      />

      {/* Grid */}
      {loading ? (
        <SkeletonGrid />
      ) : sorted.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sorted.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                priority={i < 4} // Primeros 4: carga eager para mejorar LCP
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />

          <p className="text-center text-xs text-gray-400 mt-4">
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString('es-AR')} productos
          </p>
        </>
      ) : (
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">🔍</span>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Sin resultados</h3>
          <p className="text-gray-500 mb-6">Probá con otra búsqueda o categoría</p>
          <button
            onClick={() => { handleCategoryChange('Todos'); setInputValue(''); handleSearch(''); }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Ver todos los productos
          </button>
        </div>
      )}
    </div>
  );
}
