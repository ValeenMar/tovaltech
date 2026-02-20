import { useState, useEffect } from 'react';
import { CATEGORIES } from '../data/products';

/**
 * useProductsMeta — obtiene categorías, marcas y proveedores desde la API.
 * Fallback a las categorías hardcodeadas si la API no responde.
 */
export function useProductsMeta() {
  const [categories, setCategories] = useState(CATEGORIES);
  const [brands, setBrands]         = useState([]);
  const [providers, setProviders]   = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch('/api/products-meta')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.categories?.length) {
          setCategories(['Todos', ...data.categories]);
        }
        setBrands(data.brands ?? []);
        setProviders(data.providers ?? []);
        setLoading(false);
      })
      .catch(() => {
        // Fallback: CATEGORIES del archivo local
        setLoading(false);
      });
  }, []);

  return { categories, brands, providers, loading };
}
