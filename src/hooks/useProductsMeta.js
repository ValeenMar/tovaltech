// src/hooks/useProductsMeta.js
// Obtiene categorías (con árbol padre/hijo), subcategorías, marcas y proveedores.

import { useState, useEffect } from 'react';

export function useProductsMeta() {
  const [categories,    setCategories]    = useState([]);
  const [categoryTree,  setCategoryTree]  = useState([]);
  const [subcategoryMap, setSubcategoryMap] = useState({});
  const [brands,        setBrands]        = useState([]);
  const [providers,     setProviders]     = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    fetch('/api/products-meta')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.categories?.length) {
          setCategories(['Todos', ...data.categories]);
        }
        if (data.categoryTree?.length) {
          setCategoryTree(data.categoryTree);
        }
        if (data.subcategoryMap) {
          setSubcategoryMap(data.subcategoryMap);
        }
        setBrands(data.brands ?? []);
        setProviders(data.providers ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { categories, categoryTree, subcategoryMap, brands, providers, loading };
}
