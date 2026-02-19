import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { CartProvider } from './context/CartContext';
import StoreLayout from './layouts/StoreLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/store/Home';
import StoreCatalog from './pages/store/StoreCatalog';
import Cart from './pages/store/Cart';
import Contact from './pages/store/Contact';

export default function App() {
  return (
    <AppProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/productos" element={<StoreCatalog />} />
              <Route path="/carrito" element={<Cart />} />
              <Route path="/contacto" element={<Contact />} />
            </Route>
            <Route path="/admin" element={<AdminLayout />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AppProvider>
  );
}