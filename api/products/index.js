// FILE: api/products/index.js
const connectDB = require("../db");

function toInt(v, fallback) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const categoria = (req.query.categoria || "").trim();
    const marca = (req.query.marca || "").trim();
    const proveedor = (req.query.proveedor || "").trim();
    const buscar = (req.query.buscar || "").trim();

    const limit = clamp(toInt(req.query.limit, 24), 1, 200);
    const offset = Math.max(0, toInt(req.query.offset, 0));

    const where = ["stock > 0"];
    if (categoria) where.push("category = @categoria");
    if (marca) where.push("brand = @marca");
    if (proveedor) where.push("provider = @proveedor");
    if (buscar) where.push("(name LIKE @buscar OR brand LIKE @buscar OR sku LIKE @buscar)");

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // total
    const countReq = pool.request();
    if (categoria) countReq.input("categoria", categoria);
    if (marca) countReq.input("marca", marca);
    if (proveedor) countReq.input("proveedor", proveedor);
    if (buscar) countReq.input("buscar", `%${buscar}%`);

    const countResult = await countReq.query(
      `SELECT COUNT(1) AS total FROM tovaltech_products ${whereSql}`
    );
    const total = countResult.recordset?.[0]?.total ?? 0;

    // items
    const itemsReq = pool.request();
    if (categoria) itemsReq.input("categoria", categoria);
    if (marca) itemsReq.input("marca", marca);
    if (proveedor) itemsReq.input("proveedor", proveedor);
    if (buscar) itemsReq.input("buscar", `%${buscar}%`);
    itemsReq.input("offset", offset);
    itemsReq.input("limit", limit);

    const itemsResult = await itemsReq.query(`
      SELECT *
      FROM tovaltech_products
      ${whereSql}
      ORDER BY updated_at DESC, id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    context.res = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: {
        items: itemsResult.recordset || [],
        total,
        limit,
        offset,
      },
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers: { "content-type": "application/json" },
      body: {
        error: "products_failed",
        message: err.message,
      },
    };
  }
};


// FILE: api/products/function.json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}


// FILE: api/productsMeta/index.js
const connectDB = require("../db");

module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const q = `
      SELECT DISTINCT category FROM tovaltech_products WHERE category IS NOT NULL AND LTRIM(RTRIM(category)) <> '' ORDER BY category;
      SELECT DISTINCT brand    FROM tovaltech_products WHERE brand IS NOT NULL AND LTRIM(RTRIM(brand)) <> '' ORDER BY brand;
      SELECT DISTINCT provider FROM tovaltech_products WHERE provider IS NOT NULL AND LTRIM(RTRIM(provider)) <> '' ORDER BY provider;
    `;

    const result = await pool.request().query(q);

    const categories = (result.recordsets?.[0] || []).map((r) => r.category);
    const brands = (result.recordsets?.[1] || []).map((r) => r.brand);
    const providers = (result.recordsets?.[2] || []).map((r) => r.provider);

    context.res = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: { categories, brands, providers },
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers: { "content-type": "application/json" },
      body: { error: "products_meta_failed", message: err.message },
    };
  }
};


// FILE: api/productsMeta/function.json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get"],
      "route": "products/meta"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}


// FILE: src/hooks/useProducts.js
import { useEffect, useMemo, useState } from "react";

function buildParams(filters) {
  const p = new URLSearchParams();
  if (filters.categoria) p.set("categoria", filters.categoria);
  if (filters.marca) p.set("marca", filters.marca);
  if (filters.proveedor) p.set("proveedor", filters.proveedor);
  if (filters.buscar) p.set("buscar", filters.buscar);
  p.set("limit", String(filters.limit ?? 24));
  p.set("offset", String(filters.offset ?? 0));
  return p.toString();
}

export function useProducts(filters = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = useMemo(() => buildParams(filters), [filters]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const r = await fetch(`/api/products?${query}`);
        const text = await r.text();

        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Respuesta no-JSON (${r.status}): ${text.slice(0, 200)}`);
        }

        if (!r.ok) {
          throw new Error(data?.message || `API error ${r.status}`);
        }

        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setTotal(Number.isFinite(data.total) ? data.total : 0);
        }
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setError(e.message || "Error desconocido");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return { items, total, loading, error };
}


// FILE: src/hooks/useProductsMeta.js
import { useEffect, useState } from "react";

export function useProductsMeta() {
  const [meta, setMeta] = useState({ categories: [], brands: [], providers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/products/meta");
        const data = await r.json();
        if (!r.ok) throw new Error(data?.message || `API error ${r.status}`);
        if (!cancelled) setMeta(data);
      } catch (e) {
        if (!cancelled) setError(e.message || "Error desconocido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { meta, loading, error };
}


// FILE: src/pages/store/StoreCatalog.jsx
import { useMemo, useState } from "react";
import ProductCard from "../../components/store/ProductCard";
import { useProducts } from "../../hooks/useProducts";
import { useProductsMeta } from "../../hooks/useProductsMeta";

export default function StoreCatalog() {
  const [categoria, setCategoria] = useState("");
  const [marca, setMarca] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [buscar, setBuscar] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [page, setPage] = useState(1);

  const limit = 24;
  const offset = (page - 1) * limit;

  const { meta } = useProductsMeta();
  const { items, total, loading, error } = useProducts({
    categoria,
    marca,
    proveedor,
    buscar,
    limit,
    offset,
  });

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sortBy === "price-asc") arr.sort((a, b) => (a.price_ars ?? 0) - (b.price_ars ?? 0));
    if (sortBy === "price-desc") arr.sort((a, b) => (b.price_ars ?? 0) - (a.price_ars ?? 0));
    return arr;
  }, [items, sortBy]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function resetAndSet(fn) {
    return (v) => {
      setPage(1);
      fn(v);
    };
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Catálogo</h1>
        <p className="text-gray-500 mt-1">Productos reales desde la base de datos</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          value={buscar}
          onChange={(e) => resetAndSet(setBuscar)(e.target.value)}
          placeholder="🔎 Buscar por nombre, marca o SKU…"
          className="md:col-span-2 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={categoria}
          onChange={(e) => resetAndSet(setCategoria)(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las categorías</option>
          {meta.categories?.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={marca}
          onChange={(e) => resetAndSet(setMarca)(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las marcas</option>
          {meta.brands?.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          value={proveedor}
          onChange={(e) => resetAndSet(setProveedor)(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los proveedores</option>
          {meta.providers?.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div className="md:col-span-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="text-sm text-gray-500">
            {loading ? "Cargando…" : `${total} producto${total !== 1 ? "s" : ""}`}
          </div>

          <div className="flex gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="default">Orden</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
            </select>

            <button
              onClick={() => {
                setPage(1);
                setCategoria("");
                setMarca("");
                setProveedor("");
                setBuscar("");
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          Cargando productos…
        </div>
      )}

      {error && (
        <div className="text-center py-16 text-red-600">
          <div className="text-4xl mb-3">⚠️</div>
          Error cargando productos: {error}
          <div className="text-sm text-gray-500 mt-2">
            Probá abrir <code className="bg-gray-100 px-2 py-1 rounded">/api/products</code> en otra pestaña y pegá el JSON acá.
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {sorted.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sorted.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">🔍</div>
              No se encontraron productos.
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-xl border border-gray-200 disabled:opacity-40"
            >
              ← Anterior
            </button>
            <div className="text-sm text-gray-600">
              Página <span className="font-semibold">{page}</span> de{" "}
              <span className="font-semibold">{totalPages}</span>
            </div>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 rounded-xl border border-gray-200 disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
