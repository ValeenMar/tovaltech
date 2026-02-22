// src/pages/store/StoreCatalog.jsx
// Catálogo con sidebar de categorías en árbol acordeón (padre → hijos expandibles).
// Al clickear un padre se expande/colapsa y filtra por todos sus hijos.
// Al clickear un hijo filtra solo ese hijo.

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
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

const PAGE_SIZE = 20;

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20" fill="currentColor"
    >
      <path fillRule="evenodd"
        d="M7.293 4.707a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd" />
    </svg>
  );
}

function ParentCategoryItem({ cat, activeCategory, onCategoryChange, onSubcatChange, children }) {
  const isActive      = activeCategory === cat.name;
  const hasChildren   = children && children.length > 0;
  const childIsActive = hasChildren && children.some(c => activeCategory === c.name);
  // open es INDEPENDIENTE de isActive — solo controla si el acordeón está expandido
  const [open, setOpen] = useState(isActive || childIsActive);

  // Si una categoría hija se activa externamente, aseguramos que el padre esté abierto
  // Pero NO forzamos open cuando isActive — así se puede colapsar aunque esté seleccionado
  useEffect(() => {
    if (childIsActive) setOpen(true);
  }, [childIsActive]);

  const handleClick = () => {
    if (hasChildren) {
      if (isActive) {
        // Ya está seleccionado → solo toggle el acordeón
        setOpen(o => !o);
        return;
      }
      // Primera vez que se clickea → abrir y seleccionar
      setOpen(true);
    }
    onCategoryChange(cat.name);
    onSubcatChange(null);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-all
          ${isActive && !childIsActive
            ? 'bg-blue-600 text-white font-semibold'
            : childIsActive
            ? 'bg-blue-50 text-blue-700 font-semibold'
            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
      >
        <span className="truncate">{cat.name}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {cat.product_count > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
              ${isActive && !childIsActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {cat.product_count > 999 ? `${Math.floor(cat.product_count/1000)}k` : cat.product_count}
            </span>
          )}
          {hasChildren && <ChevronIcon open={open} />}
        </div>
      </button>

      {hasChildren && open && (
        <div className="border-l-2 border-blue-100 ml-4 mb-0.5">
          {children.map(child => (
            <button
              key={child.id ?? child.name}
              onClick={() => { onCategoryChange(child.name); onSubcatChange(null); }}
              className={`w-full text-left pl-3 pr-4 py-2 text-[13px] flex items-center justify-between gap-2 transition-all
                ${activeCategory === child.name
                  ? 'text-blue-700 font-semibold bg-blue-50'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
            >
              <span className="truncate">{child.name}</span>
              {child.product_count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0
                  ${activeCategory === child.name ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                  {child.product_count > 999 ? `${Math.floor(child.product_count/1000)}k` : child.product_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const FilterSidebar = memo(({ categoryTree, categories, activeCategory, activeSubcat, onCategoryChange, onSubcatChange, dolarRate }) => {
  const parentsWithChildren = categoryTree.filter(c => c.children?.length > 0);
  const parentsAlone        = categoryTree.filter(c => !c.children?.length);
  const allTreeNames = new Set([
    ...categoryTree.map(c => c.name),
    ...categoryTree.flatMap(c => c.children?.map(ch => ch.name) ?? []),
  ]);
  const orphans = categories.filter(c => c !== 'Todos' && !allTreeNames.has(c));

  return (
    <aside className="w-52 flex-shrink-0 hidden lg:block self-start sticky top-4 space-y-3">
      {dolarRate && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Tipo de cambio</p>
          <p className="font-bold text-gray-800 text-sm">1 USD = ${dolarRate.toLocaleString('es-AR')} ARS</p>
          <p className="text-[11px] text-gray-400">Dólar oficial</p>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Categorías</h3>
        </div>
        <div className="py-1.5">
          <button
            onClick={() => { onCategoryChange('Todos'); onSubcatChange(null); }}
            className={`w-full text-left px-4 py-2.5 text-sm transition-all flex items-center gap-2
              ${activeCategory === 'Todos'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <span className="text-base">🗂️</span>
            <span>Todos</span>
          </button>

          {parentsWithChildren.map(cat => (
            <ParentCategoryItem
              key={cat.id ?? cat.name}
              cat={cat}
              activeCategory={activeCategory}
              activeSubcat={activeSubcat}
              onCategoryChange={onCategoryChange}
              onSubcatChange={onSubcatChange}
            >
              {cat.children}
            </ParentCategoryItem>
          ))}

          {parentsAlone.map(cat => (
            <button
              key={cat.id ?? cat.name}
              onClick={() => { onCategoryChange(cat.name); onSubcatChange(null); }}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-all
                ${activeCategory === cat.name
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <span className="truncate">{cat.name}</span>
              {cat.product_count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0
                  ${activeCategory === cat.name ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {cat.product_count > 999 ? `${Math.floor(cat.product_count/1000)}k` : cat.product_count}
                </span>
              )}
            </button>
          ))}

          {orphans.map(name => (
            <button
              key={name}
              onClick={() => { onCategoryChange(name); onSubcatChange(null); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-all
                ${activeCategory === name
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
});
FilterSidebar.displayName = 'FilterSidebar';

const MobileFilters = memo(({ categoryTree, categories, activeCategory, activeSubcat, onCategoryChange, onSubcatChange, open, onClose }) => {
  if (!open) return null;

  const allTreeNames = new Set([
    ...categoryTree.map(c => c.name),
    ...categoryTree.flatMap(c => c.children?.map(ch => ch.name) ?? []),
  ]);
  const orphans = categories.filter(c => c !== 'Todos' && !allTreeNames.has(c));

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Categorías</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          <button
            onClick={() => { onCategoryChange('Todos'); onSubcatChange(null); onClose(); }}
            className={`w-full text-left px-5 py-3 text-sm flex items-center gap-2 transition-all
              ${activeCategory === 'Todos' ? 'bg-blue-600 text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            🗂️ Todos
          </button>
          {categoryTree.map(cat => {
            const hasChildren = cat.children?.length > 0;
            const childIsActive = hasChildren && cat.children.some(c => activeCategory === c.name);
            const isActive = activeCategory === cat.name;
            return (
              <MobileCatItem key={cat.id ?? cat.name} cat={cat} hasChildren={hasChildren}
                childIsActive={childIsActive} isActive={isActive}
                activeCategory={activeCategory}
                onCategoryChange={onCategoryChange} onSubcatChange={onSubcatChange} onClose={onClose} />
            );
          })}
          {orphans.map(name => (
            <button key={name}
              onClick={() => { onCategoryChange(name); onSubcatChange(null); onClose(); }}
              className={`w-full text-left px-5 py-3 text-sm transition-all
                ${activeCategory === name ? 'bg-blue-600 text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
MobileFilters.displayName = 'MobileFilters';

function MobileCatItem({ cat, hasChildren, childIsActive, isActive, activeCategory, onCategoryChange, onSubcatChange, onClose }) {
  const [localOpen, setLocalOpen] = useState(isActive || childIsActive);
  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            if (isActive) {
              setLocalOpen(o => !o);
              return;
            }
            setLocalOpen(true);
          }
          onCategoryChange(cat.name);
          onSubcatChange(null);
          if (!hasChildren) onClose();
        }}
        className={`w-full text-left px-5 py-3 text-sm flex items-center justify-between gap-2 transition-all
          ${isActive && !childIsActive ? 'bg-blue-600 text-white font-semibold'
            : childIsActive ? 'bg-blue-50 text-blue-700 font-semibold'
            : 'text-gray-600 hover:bg-gray-50'}`}
      >
        <span>{cat.name}</span>
        {hasChildren && <ChevronIcon open={localOpen || isActive || childIsActive} />}
      </button>
      {hasChildren && localOpen && (
        <div className="border-l-2 border-blue-100 ml-5">
          {cat.children.map(child => (
            <button key={child.id ?? child.name}
              onClick={() => { onCategoryChange(child.name); onSubcatChange(null); onClose(); }}
              className={`w-full text-left pl-4 pr-5 py-2.5 text-[13px] transition-all
                ${activeCategory === child.name
                  ? 'text-blue-700 font-semibold bg-blue-50'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
              {child.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

export default function StoreCatalog() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [activeSubcat,   setActiveSubcat]   = useState(null);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [inputValue,     setInputValue]     = useState('');
  const [sortBy,         setSortBy]         = useState('default');
  const [page,           setPage]           = useState(0);
  const [mobileOpen,     setMobileOpen]     = useState(false);

  const { categories, categoryTree } = useProductsMeta();
  useSEO({
    title: activeCategory !== 'Todos' ? activeCategory : 'Catálogo de Productos',
    description: 'Explorá nuestro catálogo completo de tecnología y computación.',
  });

  const activeCatNode = useMemo(
    () => categoryTree.find(c => c.name === activeCategory),
    [categoryTree, activeCategory]
  );
  const isParentSelected = activeCatNode && activeCatNode.children?.length > 0;

  const filters = useMemo(() => ({
    categoria:    activeCategory !== 'Todos' ? activeCategory : '',
    hijos:        isParentSelected
                    ? activeCatNode.children.map(c => c.name).join(',')
                    : '',
    subcategoria: activeSubcat ?? '',
    buscar:       searchTerm,
    limit:        PAGE_SIZE,
    offset:       page * PAGE_SIZE,
  }), [activeCategory, activeSubcat, searchTerm, page, isParentSelected, activeCatNode]);

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

  const handleSearch = useCallback((val) => { setSearchTerm(val); setPage(0); }, []);
  const handleCategoryChange = useCallback((cat) => { setActiveCategory(cat); setActiveSubcat(null); setPage(0); }, []);
  const handleSubcatChange = useCallback((sub) => { setActiveSubcat(sub); setPage(0); }, []);

  const activeFiltersCount = (activeCategory !== 'Todos' ? 1 : 0) + (activeSubcat ? 1 : 0);

  const parentOfActive = useMemo(() => {
    if (activeCategory === 'Todos') return null;
    return categoryTree.find(c => c.children?.some(ch => ch.name === activeCategory)) ?? null;
  }, [activeCategory, categoryTree]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Nuestros Productos</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {loading ? 'Cargando...' : `${total.toLocaleString('es-AR')} producto${total !== 1 ? 's' : ''} disponibles`}
        </p>
        {parentOfActive && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
            <button onClick={() => handleCategoryChange(parentOfActive.name)} className="hover:text-blue-600 transition-colors">
              {parentOfActive.name}
            </button>
            <span>›</span>
            <span className="text-gray-600 font-medium">{activeCategory}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2.5 mb-5 flex gap-2 items-center">
        <button onClick={() => setMobileOpen(true)}
          className="lg:hidden flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex-shrink-0">
          ☰
          {activeFiltersCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>
          )}
        </button>

        <label htmlFor="catalog-search" className="sr-only">Buscar productos</label>
        <input id="catalog-search" name="catalog-search" type="text"
          placeholder="🔍 Buscar por nombre o marca..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch(inputValue)}
          onBlur={() => inputValue !== searchTerm && handleSearch(inputValue)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Label visualmente oculto para accesibilidad — resuelve el warning de Lighthouse */}
        <label htmlFor="catalog-sort" className="sr-only">Ordenar productos</label>
        <select id="catalog-sort" name="catalog-sort" value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[165px] hidden sm:block">
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {activeCategory !== 'Todos' && (
          <button onClick={() => handleCategoryChange('Todos')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 flex-shrink-0 whitespace-nowrap">
            <span className="capitalize max-w-[120px] truncate">{activeCategory}</span>
            <span className="text-blue-400">✕</span>
          </button>
        )}
      </div>

      <div className="flex gap-5">
        <FilterSidebar
          categories={categories}
          categoryTree={categoryTree}
          activeCategory={activeCategory}
          activeSubcat={activeSubcat}
          onCategoryChange={handleCategoryChange}
          onSubcatChange={handleSubcatChange}
          dolarRate={dolarRate}
        />

        <div className="flex-1 min-w-0">
          {loading ? (
            <SkeletonGrid />
          ) : sorted.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {sorted.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 8} />)}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              <p className="text-center text-xs text-gray-400 mt-3">
                Mostrando {(page * PAGE_SIZE + 1).toLocaleString('es-AR')} – {Math.min((page + 1) * PAGE_SIZE, total).toLocaleString('es-AR')} de {total.toLocaleString('es-AR')} productos
              </p>
            </>
          ) : (
            <div className="text-center py-20">
              <span className="text-5xl mb-4 block">🔍</span>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Sin resultados</h3>
              <p className="text-gray-500 text-sm mb-5">Probá con otra búsqueda o categoría</p>
              <button onClick={() => { handleCategoryChange('Todos'); setInputValue(''); handleSearch(''); }}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Ver todos los productos
              </button>
            </div>
          )}
        </div>
      </div>

      <MobileFilters
        categories={categories}
        categoryTree={categoryTree}
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
