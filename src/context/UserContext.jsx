// src/context/UserContext.jsx
// Guarda los datos del cliente en localStorage para pre-llenar el checkout.
// No requiere registro ni contraseña — puramente local en el browser.

import { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'tovaltech_user';

const defaultUser = {
  name:     '',
  lastName: '',
  email:    '',
  phone:    '',
  zone:     'CABA',
  address:  '',
  city:     '',
};

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validar que tenga al menos email o nombre
    if (!parsed.email && !parsed.name) return null;
    return { ...defaultUser, ...parsed };
  } catch {
    return null;
  }
}

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => loadFromStorage());

  // Guarda los datos del usuario en localStorage y en el estado
  const saveUser = useCallback((data) => {
    const merged = { ...defaultUser, ...data };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Ignore storage quota/unavailable errors.
    }
    setUser(merged);
  }, []);

  // Borra todos los datos guardados
  const clearUser = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage quota/unavailable errors.
    }
    setUser(null);
  }, []);

  // Dice si el usuario tiene datos guardados suficientes para pre-llenar
  const hasSavedData = Boolean(user?.name && user?.email);

  return (
    <UserContext.Provider value={{ user, saveUser, clearUser, hasSavedData, defaultUser }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser debe usarse dentro de UserProvider');
  return ctx;
};
