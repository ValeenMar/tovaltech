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

const PAGE_SIZE = 28;

// ── Sidebar de filtros ────────────────────────────────────────────────────────
const FilterSidebar = memo(({ categories, activeCategory, onChange, dolarRate }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? categories : categories.slice(0, 12);

  return (
    <aside className="w-56 flex-shrink-0 hidden lg:block">
      {/* Tipo de cambio */}
      {dolarRate && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-sm">
          <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-1">Tipo de cambio</p>
          <p className="font-bold text-gray-800">
            1 USD = ${dolarRate.toLocaleString('es-AR')} ARS
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Dólar oficial</p>
        </div>
      )}

      {/* Categorías */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Categorías</h3>
        <div className="flex flex-col gap-0.5">
          {visible.map(cat => (
            <button
              key={cat}
              onClick={() => onChange(cat)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-all capitalize
                ${activeCategory === cat
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              {cat === 'Todos' ? '🗂️ Todos' : cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
            </button>
          ))}
          {categories.length > 12 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-left px-3 py-2 text-xs text-blue-500 hover:text-blue-700 font-medium mt-1"
            >
              {expanded ? '↑ Ver menos' : `+ ${categories.length - 12} más categorías`}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
});
FilterSidebar.displayName = 'FilterSidebar';

// ── Filtros móvil (drawer) ────────────────────────────────────────────────────
const MobileFilters = memo(({ categories, activeCategory, onChange, open, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-800">Categorías</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { onChange(cat); onClose(); }}
                className={`text-left px-4 py-3 rounded-lg text-sm capitalize transition-all
                  ${activeCategory === cat
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {cat === 'Todos' ? '🗂️ Todos' : cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
MobileFilters.displayName = 'MobileFilters';

// ── Paginación ────────────────────────────────────────────────────────────────
const Pagination = memo(({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;
  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const arr = [0];
    if (page > 2) arr.push(-1);
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) arr.push(i);
    if (page < totalPages - 3) arr.push(-1);
    arr.push(totalPages - 1);
    return arr;
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-center gap-1.5 mt-10">
      <button onClick={() => onChange(p => Math.max(0, p - 1))} disabled={page === 0}
        className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        ← Anterior
      </button>
      {pages.map((p, i) => p === -1
        ? <span key={`e${i}`} className="px-2 text-gray-400 text-sm">…</span>
        : <button key={p} onClick={() => onChange(() => p)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
              ${page === p ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>
            {p + 1}
          </button>
      )}
      <button onClick={() => onChange(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
        className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        Siguiente →
      </button>
    </div>
  );
});
Pagination.displayName = 'Pagination';

// ── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
    {[...Array(PAGE_SIZE)].map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
        <div className="bg-gray-100 h-44" />
        <div className="p-4 space-y-2">
          <div className="bg-gray-100 h-3 rounded w-1/3" />
          <div className="bg-gray-100 h-3 rounded w-full" />
          <div className="bg-gray-100 h-3 rounded w-3/4" />
          <div className="bg-gray-100 h-8 rounded mt-3" />
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
  const [mobileOpen, setMobileOpen]         = useState(false);

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
  const dolarRate  = products[0]?.dolar_rate;

  const handleSearch = useCallback((val) => {
    setSearchTerm(val);
    setPage(0);
  }, []);

  const handleCategoryChange = useCallback((cat) => {
    setActiveCategory(cat);
    setPage(0);
  }, []);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Nuestros Productos</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {loading ? 'Cargando...' : `${total.toLocaleString('es-AR')} producto${total !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Barra superior: búsqueda + sort + botón filtro móvil */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-6 flex gap-3 items-center">
        {/* Botón filtros móvil */}
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex-shrink-0"
        >
          ☰ Categorías
          {activeCategory !== 'Todos' && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">1</span>
          )}
        </button>

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
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[170px] hidden sm:block"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Chip categoría activa + limpiar */}
        {activeCategory !== 'Todos' && (
          <button
            onClick={() => handleCategoryChange('Todos')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200
                       text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 flex-shrink-0"
          >
            <span className="capitalize">{activeCategory.toLowerCase()}</span>
            <span className="text-blue-400">✕</span>
          </button>
        )}
      </div>

      {/* Layout: sidebar + grid */}
      <div className="flex gap-6">
        {/* Sidebar desktop */}
        <FilterSidebar
          categories={categories}
          activeCategory={activeCategory}
          onChange={handleCategoryChange}
          dolarRate={dolarRate}
        />

        {/* Grid principal */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <SkeletonGrid />
          ) : sorted.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {sorted.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
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
      </div>

      {/* Filtros móvil */}
      <MobileFilters
        categories={categories}
        activeCategory={activeCategory}
        onChange={handleCategoryChange}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
    </div>
  );
}
