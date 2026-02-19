import { useState } from 'react';
import ProductCard from '../../components/store/ProductCard';
import { useProducts } from '../../hooks/useProducts';

const categories = ["Todos", "Audio", "Periféricos", "Monitores", "Accesorios", "Almacenamiento", "Computadoras", "Hardware"];

export default function StoreCatalog() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default');

  const { products, loading, error } = useProducts({
    categoria: activeCategory !== 'Todos' ? activeCategory : '',
    buscar: searchTerm
  });

  let filtered = [...products];
  if (sortBy === 'price-asc')  filtered.sort((a, b) => a.price_ars - b.price_ars);
  if (sortBy === 'price-desc') filtered.sort((a, b) => b.price_ars - a.price_ars);
  if (sortBy === 'rating')     filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Nuestros Productos</h1>
        <p className="text-gray-500 mt-1">Encontrá lo que necesitás</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-8 flex flex-col md:flex-row gap-4">
        <input type="text" placeholder="🔍 Buscar productos..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="default">Ordenar por</option>
          <option value="price-asc">Precio: menor a mayor</option>
          <option value="price-desc">Precio: mayor a menor</option>
          <option value="rating">Mejor valorados</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Estados de carga y error */}
      {loading && (
        <div className="text-center py-16">
          <span className="text-5xl mb-4 block animate-spin">⏳</span>
          <p className="text-gray-500">Cargando productos...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-16 text-red-500">
          <span className="text-5xl mb-4 block">⚠️</span>
          <p>Error al cargar productos: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="text-sm text-gray-500 mb-4">{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="text-center py-16">
              <span className="text-6xl mb-4 block">🔍</span>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No se encontraron productos</h3>
              <p className="text-gray-500">Probá con otra búsqueda o categoría</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}