import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider }   from './context/AppContext';
import { CartProvider }  from './context/CartContext';
import { UserProvider }  from './context/UserContext';
import StoreLayout       from './layouts/StoreLayout';
import AdminLayout       from './layouts/AdminLayout';
import Home              from './pages/store/Home';
import StoreCatalog      from './pages/store/StoreCatalog';
import ProductDetail     from './pages/store/ProductDetail';
import Cart              from './pages/store/Cart';
import Checkout          from './pages/store/Checkout';
import CheckoutResultado from './pages/store/CheckoutResultado';
import Contact           from './pages/store/Contact';
import MisDatos          from './pages/store/MisDatos';
// Admin pages
import Dashboard  from './pages/Dashboard';
import Orders     from './pages/Orders';
import Products   from './pages/Products';
import Categories from './pages/Categories';
import Banners    from './pages/Banners';
import Customers  from './pages/Customers';
import Invoices   from './pages/Invoices';
import Analytics  from './pages/Analytics';
import Settings   from './pages/Settings';

export default function App() {
  return (
    <AppProvider>
      <CartProvider>
        <UserProvider>
          <BrowserRouter>
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
          </BrowserRouter>
        </UserProvider>
      </CartProvider>
    </AppProvider>
  );
}
