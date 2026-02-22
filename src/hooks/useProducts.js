import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { apiFetch, buildQuery } from '../lib/apiClient';

/**
 * useProducts — obtiene productos para la tienda.
 *
 * Flujo:
 *  1. Intenta GET /api/products (Azure Function → Azure SQL)
 *     La API devuelve: { items: [], total, limit, offset }
 *  2. Si la API falla, filtra los productos del AppContext (fallback local).
 *
 * Retorna: { products, total, loading, error, fromApi }
 */
export function useProducts(filters = {}) {
  const { products: contextProducts } = useApp();
  const [products, setProducts] = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [fromApi, setFromApi]   = useState(false);

  // Evitar llamadas en vuelo solapadas
  const controllerRef = useRef(null);

  useEffect(() => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    const query = buildQuery({
      categoria: filters.categoria,
      hijos: filters.hijos,
      subcategoria: filters.subcategoria,
      buscar: filters.buscar,
      limit: filters.limit,
      offset: filters.offset,
    });

    apiFetch(`/api/products?${query}`, { signal: controller.signal })
      .then(data => {
        // La API devuelve { items: [...], total, limit, offset }
        const items = Array.isArray(data) ? data : (data.items ?? []);
        const count = data.total ?? items.length;
        setProducts(items);
        setTotal(count);
        setFromApi(true);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;

        // Fallback silencioso al context
        let fallback = contextProducts.filter(p => p.stock > 0);
        if (filters.categoria) {
          fallback = fallback.filter(p => p.category === filters.categoria);
        }
        if (filters.buscar) {
          const term = filters.buscar.toLowerCase();
          fallback = fallback.filter(p =>
            p.name.toLowerCase().includes(term) ||
            (p.brand ?? '').toLowerCase().includes(term)
          );
        }

        setProducts(fallback);
        setTotal(fallback.length);
        setFromApi(false);
        setLoading(false);
        setError(null);
      });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.categoria, filters.hijos, filters.subcategoria, filters.buscar, filters.limit, filters.offset]);

  return { products, total, loading, error, fromApi };
}
