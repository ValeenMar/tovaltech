// src/hooks/useAdminProducts.js
// Hook para cargar productos en el PANEL ADMIN desde Azure SQL.
// A diferencia de useProducts (tienda), este:
//   - No filtra por stock > 0 (ve todos los productos)
//   - Devuelve price_ars_cost / price_usd_cost (precio neto con IVA del mayorista)
//   - Devuelve markup_pct por producto y global_markup_pct

import { useState, useEffect, useCallback, useRef } from 'react';

export function useAdminProducts(filters = {}) {
  const [products,     setProducts]     = useState([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [globalMarkup, setGlobalMarkup] = useState(null);
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: 500, admin: '1' });
      if (filters.buscar)    params.set('buscar',    filters.buscar);
      if (filters.categoria) params.set('categoria', filters.categoria);
      if (filters.proveedor) params.set('proveedor', filters.proveedor);
      if (filters.marca)     params.set('marca',     filters.marca);

      const res = await fetch(`/api/products?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setProducts(data.items ?? []);
      setTotal(data.total ?? 0);
      setGlobalMarkup(data.global_markup_pct ?? null);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.buscar, filters.categoria, filters.proveedor, filters.marca]);

  useEffect(() => { load(); }, [load]);

  return { products, total, loading, error, globalMarkup, reload: load };
}