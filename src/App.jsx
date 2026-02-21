import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider }   from './context/AppContext';
import { CartProvider }  from './context/CartContext';
import { UserProvider }  from './context/UserContext';
import StoreLayout       from './layouts/StoreLayout';
import AdminLayout       from './layouts/AdminLayout';

// ── Tienda — lazy loading por ruta ────────────────────────────────────────────
// Cada página se descarga solo cuando el usuario la visita por primera vez.
// Reduce el bundle inicial de ~360 KiB a ~120 KiB para clientes de la tienda.
const Home              = lazy(() => import('./pages/store/Home'));
const StoreCatalog      = lazy(() => import('./pages/store/StoreCatalog'));
const ProductDetail     = lazy(() => import('./pages/store/ProductDetail'));
const Cart              = lazy(() => import('./pages/store/Cart'));
const Checkout          = lazy(() => import('./pages/store/Checkout'));
const CheckoutResultado = lazy(() => import('./pages/store/CheckoutResultado'));
const Contact           = lazy(() => import('./pages/store/Contact'));
const MisDatos          = lazy(() => import('./pages/store/MisDatos'));

// ── Admin — lazy loading (estas páginas son muy grandes y solo las usa Valentín)
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Orders     = lazy(() => import('./pages/Orders'));
const Products   = lazy(() => import('./pages/Products'));
const Categories = lazy(() => import('./pages/Categories'));
const Banners    = lazy(() => import('./pages/Banners'));
const Customers  = lazy(() => import('./pages/Customers'));
const Invoices   = lazy(() => import('./pages/Invoices'));
const Analytics  = lazy(() => import('./pages/Analytics'));
const Settings   = lazy(() => import('./pages/Settings'));

// Spinner mínimo mientras carga cada chunk
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <CartProvider>
        <UserProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Tienda ─────────────────────────────────────────── */}
                <Route element={<StoreLayout />}>
                  <Route path="/"                   element={<Home />} />
                  <Route path="/productos"          element={<StoreCatalog />} />
                  <Route path="/productos/:id"      element={<ProductDetail />} />
                  <Route path="/carrito"            element={<Cart />} />
                  <Route path="/checkout"           element={<Checkout />} />
                  <Route path="/checkout/resultado" element={<CheckoutResultado />} />
                  <Route path="/contacto"           element={<Contact />} />
                  <Route path="/mis-datos"          element={<MisDatos />} />
                </Route>

                {/* ── Admin ──────────────────────────────────────────── */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index             element={<Dashboard />} />
                  <Route path="orders"     element={<Orders />} />
                  <Route path="products"   element={<Products />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="banners"    element={<Banners />} />
                  <Route path="customers"  element={<Customers />} />
                  <Route path="invoices"   element={<Invoices />} />
                  <Route path="analytics"  element={<Analytics />} />
                  <Route path="settings"   element={<Settings />} />
                  <Route path="*"          element={<Navigate to="/admin" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </UserProvider>
      </CartProvider>
    </AppProvider>
  );
}

