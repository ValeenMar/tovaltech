import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

export default function App() {
  return (
    <AppProvider>
      <CartProvider>
        <UserProvider>
          <BrowserRouter>
            <Routes>
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
              <Route path="/admin" element={<AdminLayout />} />
            </Routes>
          </BrowserRouter>
        </UserProvider>
      </CartProvider>
    </AppProvider>
  );
}
