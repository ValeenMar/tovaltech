import { createContext, useContext, useState, useEffect } from 'react';
import { useRef } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

const GUEST_STORAGE_KEY = 'tovaltech_cart_guest';

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

function loadCart(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map(sanitizeItem).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function saveCart(storageKey, items) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // Ignore storage quota/unavailable errors.
  }
}

function removeCart(storageKey) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage quota/unavailable errors.
  }
}

function getUserCartKey(userId) {
  return `tovaltech_cart_user_${userId}`;
}

function mergeItems(base, incoming) {
  const map = new Map();

  const addOne = (raw) => {
    const item = sanitizeItem(raw);
    if (!item) return;

    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      return;
    }

    const mergedStock = toStock(item.stock) ?? toStock(existing.stock);
    const nextQty = clampByStock(existing.quantity + item.quantity, mergedStock);
    if (nextQty <= 0) {
      map.delete(item.id);
      return;
    }

    map.set(item.id, {
      ...existing,
      ...item,
      stock: mergedStock,
      quantity: nextQty,
    });
  };

  (base || []).forEach(addOne);
  (incoming || []).forEach(addOne);
  return Array.from(map.values());
}

export function CartProvider({ children }) {
  const { authUser, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState(() => loadCart(GUEST_STORAGE_KEY));
  const prevUserIdRef = useRef(undefined);

  const currentUserId = authUser?.id ?? null;
  const activeStorageKey = currentUserId ? getUserCartKey(currentUserId) : GUEST_STORAGE_KEY;

  useEffect(() => {
    if (authLoading) return;

    const prevUserId = prevUserIdRef.current;
    const firstInit = prevUserId === undefined;

    if (firstInit) {
      if (currentUserId) {
        const userKey = getUserCartKey(currentUserId);
        const userItems = loadCart(userKey);
        const guestItems = loadCart(GUEST_STORAGE_KEY);
        const merged = mergeItems(userItems, guestItems);
        setCartItems(merged);
        saveCart(userKey, merged);
      } else {
        setCartItems(loadCart(GUEST_STORAGE_KEY));
      }

      prevUserIdRef.current = currentUserId;
      return;
    }

    if (prevUserId === currentUserId) return;

    // Logout: mantener continuidad pasando el carrito de cuenta a invitado.
    if (prevUserId && !currentUserId) {
      const guestItems = loadCart(GUEST_STORAGE_KEY);
      const mergedGuest = mergeItems(guestItems, cartItems);
      setCartItems(mergedGuest);
      saveCart(GUEST_STORAGE_KEY, mergedGuest);
      prevUserIdRef.current = currentUserId;
      return;
    }

    // Login: merge carrito invitado + carrito previo de la cuenta.
    if (!prevUserId && currentUserId) {
      const userKey = getUserCartKey(currentUserId);
      const userItems = loadCart(userKey);
      const guestItems = loadCart(GUEST_STORAGE_KEY);
      const merged = mergeItems(userItems, guestItems);
      setCartItems(merged);
      saveCart(userKey, merged);
      removeCart(GUEST_STORAGE_KEY);
      prevUserIdRef.current = currentUserId;
      return;
    }

    // Cambio entre cuentas.
    if (prevUserId && currentUserId && prevUserId !== currentUserId) {
      const nextItems = loadCart(getUserCartKey(currentUserId));
      setCartItems(nextItems);
      prevUserIdRef.current = currentUserId;
    }
  }, [authLoading, currentUserId, cartItems]);

  // Persistencia automática en el storage activo (guest o user_<id>).
  useEffect(() => {
    if (authLoading) return;
    if (prevUserIdRef.current !== currentUserId) return;
    saveCart(activeStorageKey, cartItems);
  }, [cartItems, activeStorageKey, authLoading, currentUserId]);

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
