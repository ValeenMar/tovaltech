import { useState, useEffect, useRef } from 'react';
import { apiFetch, buildQuery } from '../lib/apiClient';

/**
 * useProducts — obtiene productos para la tienda.
 *
 * Flujo:
 *  1. Intenta GET /api/products (Azure Function → Azure SQL)
 *     La API devuelve: { items: [], total, limit, offset }
 *  2. Si la API falla, devuelve colección vacía y error.
 *
 * Retorna: { products, total, loading, error, fromApi }
 */
export function useProducts(filters = {}) {
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

        // Si la API falla, devolvemos vacío en vez de usar contexto legacy inexistente.
        setProducts([]);
        setTotal(0);
        setFromApi(false);
        setLoading(false);
        setError(err.message || 'products_fetch_failed');
      });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.categoria, filters.hijos, filters.subcategoria, filters.buscar, filters.limit, filters.offset]);

  return { products, total, loading, error, fromApi };
}
