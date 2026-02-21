// src/pages/store/StoreCatalog.jsx
// Catálogo con subcategorías como chips de filtro debajo del sidebar.
// Cuando seleccionás una categoría padre, aparecen chips de subcategorías
// (definidas en admin) para filtrar más fino.

import { useState, useMemo, useCallback, memo } from 'react';
import { useSEO } from '../../hooks/useSEO';
import ProductCard from '../../components/store/ProductCard';
import { useProducts } from '../../hooks/useProducts';
import { useProductsMeta } from '../../hooks/useProductsMeta';

const SORT_OPTIONS = [
  { value: 'default',    label: 'Relevancia' },
  { value: 'price-asc',  label: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Precio: mayor a menor' },
  { value: 'name',       label: 'Nombre A→Z' },
];

const PAGE_SIZE = 32;

// ── Sidebar de filtros ────────────────────────────────────────────────────────
const FilterSidebar = memo(({ categories, categoryTree, subcategoryMap, activeCategory, activeSubcat, onCategoryChange, onSubcatChange, dolarRate }) => {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE_LIMIT = 12;
  const cats    = categories.filter(c => c !== 'Todos');
  const visible = expanded ? cats : cats.slice(0, VISIBLE_LIMIT);

  // Subcategorías disponibles para la categoría activa
  const subcats = activeCategory !== 'Todos'
    ? (subcategoryMap[activeCategory] || [])
    : [];

  // También mostrar subcategorías hijas del árbol para la categoría activa
  const treeChildren = useMemo(() => {
    if (activeCategory === 'Todos') return [];
    const parent = categoryTree.find(c => c.name === activeCategory);
    return parent?.children?.map(c => c.name) ?? [];
  }, [activeCategory, categoryTree]);

  const allSubcats = [...new Set([...subcats, ...treeChildren])].sort();

  return (
    <aside className="w-52 flex-shrink-0 hidden lg:block self-start sticky top-4 space-y-3">
      {/* Tipo de cambio */}
      {dolarRate && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Tipo de cambio</p>
          <p className="font-bold text-gray-800 text-sm">1 USD = ${dolarRate.toLocaleString('es-AR')} ARS</p>
          <p className="text-[11px] text-gray-400">Dólar oficial</p>
        </div>
      )}

      {/* Categorías */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Categorías</h3>
        </div>
        <div className="py-2">
          {/* Todos */}
          <button
            onClick={() => { onCategoryChange('Todos'); onSubcatChange(null); }}
            className={`w-full text-left px-4 py-2 text-sm transition-all
              ${activeCategory === 'Todos'
                ? 'bg-blue-600 text-white font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            🗂️ <span className="ml-1">Todos</span>
          </button>

          {/* Categorías padre */}
          {visible.map(cat => (
            <button
              key={cat}
              onClick={() => { onCategoryChange(cat); onSubcatChange(null); }}
              className={`w-full text-left px-4 py-2 text-sm transition-all capitalize
                ${activeCategory === cat
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
            </button>
          ))}

          {cats.length > VISIBLE_LIMIT && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full text-left px-4 py-2 text-xs text-blue-500 hover:text-blue-700 font-medium border-t border-gray-50 mt-1"
            >
              {expanded ? '↑ Ver menos' : `+ ${cats.length - VISIBLE_LIMIT} más`}
            </button>
          )}
        </div>
      </div>

      {/* Subcategorías — aparecen cuando se elige una categoría padre */}
      {allSubcats.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Subcategorías</h3>
          </div>
          <div className="py-2">
            {allSubcats.map(sub => (
              <button
                key={sub}
                onClick={() => onSubcatChange(activeSubcat === sub ? null : sub)}
                className={`w-full text-left px-4 py-2 text-sm transition-all
                  ${activeSubcat === sub
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <span className="mr-1.5 text-gray-300">└</span>
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
});
FilterSidebar.displayName = 'FilterSidebar';

// ── Filtros móvil (drawer) ────────────────────────────────────────────────────
const MobileFilters = memo(({ categories, categoryTree, subcategoryMap, activeCategory, activeSubcat, onCategoryChange, onSubcatChange, open, onClose }) => {
  if (!open) return null;

  const subcats = activeCategory !== 'Todos'
    ? [...new Set([
        ...(subcategoryMap[activeCategory] || []),
        ...(categoryTree.find(c => c.name === activeCategory)?.children?.map(c => c.name) ?? [])
      ])].sort()
    : [];

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Categorías</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <button
            onClick={() => { onCategoryChange('Todos'); onSubcatChange(null); onClose(); }}
            className={`w-full text-left px-5 py-3 text-sm transition-all
              ${activeCategory === 'Todos' ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            🗂️ Todos
          </button>
          {categories.filter(c => c !== 'Todos').map(cat => (
            <button
              key={cat}
              onClick={() => { onCategoryChange(cat); onSubcatChange(null); onClose(); }}
              className={`w-full text-left px-5 py-3 text-sm capitalize transition-all
                ${activeCategory === cat ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
            </button>
          ))}

          {subcats.length > 0 && (
            <>
              <div className="px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-t mt-1">
                Subcategorías
              </div>
              {subcats.map(sub => (
                <button
                  key={sub}
                  onClick={() => { onSubcatChange(activeSubcat === sub ? null : sub); onClose(); }}
                  className={`w-full text-left px-6 py-2.5 text-sm transition-all
                    ${activeSubcat === sub ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  └ {sub}
                </button>
              ))}
            </>
          )}
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
        className="px-4 py-2 rounded-lg bg-white border text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        ← Anterior
      </button>
      {pages.map((p, i) => p === -1
        ? <span key={`e${i}`} className="px-2 text-gray-400 text-sm">…</span>
        : <button key={p} onClick={() => onChange(() => p)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
              ${page === p ? 'bg-blue-600 text-white shadow-md' : 'bg-white border hover:bg-gray-50'}`}>
            {p + 1}
          </button>
      )}
      <button onClick={() => onChange(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
        className="px-4 py-2 rounded-lg bg-white border text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        Siguiente →
      </button>
    </div>
  );
});
Pagination.displayName = 'Pagination';

// ── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {[...Array(12)].map((_, i) => (
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
  const [activeSubcat,   setActiveSubcat]   = useState(null);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [inputValue,     setInputValue]     = useState('');
  const [sortBy,         setSortBy]         = useState('default');
  const [page,           setPage]           = useState(0);
  const [mobileOpen,     setMobileOpen]     = useState(false);

  const { categories, categoryTree, subcategoryMap } = useProductsMeta();
  useSEO({
    title: activeCategory !== 'Todos'
      ? (activeSubcat ? `${activeSubcat} — ${activeCategory}` : activeCategory)
      : 'Catálogo de Productos',
    description: 'Explorá nuestro catálogo completo de tecnología y computación.',
  });

  const filters = useMemo(() => ({
    categoria:    activeCategory !== 'Todos' ? activeCategory : '',
    subcategoria: activeSubcat ?? '',
    buscar:       searchTerm,
    limit:        PAGE_SIZE,
    offset:       page * PAGE_SIZE,
  }), [activeCategory, activeSubcat, searchTerm, page]);

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
    setActiveSubcat(null);
    setPage(0);
  }, []);

  const handleSubcatChange = useCallback((sub) => {
    setActiveSubcat(sub);
    setPage(0);
  }, []);

  const activeFiltersCount = (activeCategory !== 'Todos' ? 1 : 0) + (activeSubcat ? 1 : 0);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Nuestros Productos</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {loading ? 'Cargando...' : `${total.toLocaleString('es-AR')} producto${total !== 1 ? 's' : ''} disponibles`}
        </p>
      </div>

      {/* Barra superior */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2.5 mb-5 flex gap-2 items-center">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex-shrink-0"
        >
          ☰
          {activeFiltersCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>
          )}
        </button>

        <input
          id="catalog-search"
          name="catalog-search"
          type="text"
          placeholder="🔍 Buscar por nombre o marca..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch(inputValue)}
          onBlur={() => inputValue !== searchTerm && handleSearch(inputValue)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <select
          id="catalog-sort"
          name="catalog-sort"
          value={sortBy}
          onChange={e => { setSortBy(e.target.value); setPage(0); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[165px] hidden sm:block"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Chips de filtros activos */}
        {activeCategory !== 'Todos' && (
          <button
            onClick={() => { handleCategoryChange('Todos'); }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200
                       text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 flex-shrink-0 whitespace-nowrap"
          >
            <span className="capitalize max-w-[100px] truncate">{activeCategory.toLowerCase()}</span>
            <span className="text-blue-400">✕</span>
          </button>
        )}
        {activeSubcat && (
          <button
            onClick={() => handleSubcatChange(null)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200
                       text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 flex-shrink-0 whitespace-nowrap"
          >
            <span className="max-w-[100px] truncate">{activeSubcat}</span>
            <span className="text-indigo-400">✕</span>
          </button>
        )}
      </div>

      {/* Layout: sidebar + grid */}
      <div className="flex gap-5">

        <FilterSidebar
          categories={categories}
          categoryTree={categoryTree}
          subcategoryMap={subcategoryMap}
          activeCategory={activeCategory}
          activeSubcat={activeSubcat}
          onCategoryChange={handleCategoryChange}
          onSubcatChange={handleSubcatChange}
          dolarRate={dolarRate}
        />

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <SkeletonGrid />
          ) : sorted.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {sorted.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>

              <Pagination page={page} totalPages={totalPages} onChange={setPage} />

              <p className="text-center text-xs text-gray-400 mt-3">
                Mostrando {(page * PAGE_SIZE + 1).toLocaleString('es-AR')}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString('es-AR')} de {total.toLocaleString('es-AR')} productos
              </p>
            </>
          ) : (
            <div className="text-center py-20">
              <span className="text-5xl mb-4 block">🔍</span>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Sin resultados</h3>
              <p className="text-gray-500 text-sm mb-5">Probá con otra búsqueda o categoría</p>
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

      <MobileFilters
        categories={categories}
        categoryTree={categoryTree}
        subcategoryMap={subcategoryMap}
        activeCategory={activeCategory}
        activeSubcat={activeSubcat}
        onCategoryChange={handleCategoryChange}
        onSubcatChange={handleSubcatChange}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
    </div>
  );
}
