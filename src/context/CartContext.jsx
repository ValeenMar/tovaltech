import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

const STORAGE_KEY = 'tovaltech_cart';

function toPositiveInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toStock(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function clampByStock(quantity, stock) {
  if (stock == null) return Math.max(1, quantity);
  return Math.max(0, Math.min(quantity, stock));
}

function sanitizeItem(raw) {
  const quantity = toPositiveInt(raw?.quantity, 1);
  const stock = toStock(raw?.stock);
  const clamped = clampByStock(quantity, stock);
  if (clamped <= 0) return null;
  return {
    ...raw,
    quantity: clamped,
    stock,
  };
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map(sanitizeItem).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => loadCart());

  // Sincronizar con localStorage cada vez que cambie el carrito
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch { /* quota exceeded u otros errores → ignorar silenciosamente */ }
  }, [cartItems]);

  const addToCart = (product) => {
    setCartItems(prev => {
      const stock = toStock(product?.stock);
      if (stock !== null && stock <= 0) return prev;

      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        const mergedStock = stock ?? toStock(existing.stock);
        const nextQty = clampByStock(existing.quantity + 1, mergedStock);
        if (nextQty <= existing.quantity) return prev;
        return prev.map(item => (
          item.id === product.id
            ? { ...item, ...product, stock: mergedStock, quantity: nextQty }
            : item
        ));
      }
      return [...prev, { ...product, stock, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => setCartItems(prev => prev.filter(item => item.id !== id));

  const updateQuantity = (id, quantity) => {
    const targetQty = toPositiveInt(quantity, 0);
    if (targetQty <= 0) return removeFromCart(id);
    setCartItems(prev => {
      const current = prev.find(item => item.id === id);
      if (!current) return prev;
      const nextQty = clampByStock(targetQty, toStock(current.stock));
      if (nextQty <= 0) return prev.filter(item => item.id !== id);
      if (nextQty === current.quantity) return prev;
      return prev.map(item => (item.id === id ? { ...item, quantity: nextQty } : item));
    });
  };

  const clearCart = () => setCartItems([]);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
