// src/context/UserContext.jsx
// Guarda los datos del cliente en localStorage para pre-llenar el checkout.
// No requiere registro ni contraseña — puramente local en el browser.

import { createContext, useContext, useState, useCallback } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';

const GUEST_STORAGE_KEY = 'tovaltech_user_guest';

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
  return loadFromStorageByKey(GUEST_STORAGE_KEY);
}

function loadFromStorageByKey(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validar que tenga al menos email o nombre
    if (!parsed.email && !parsed.name) return null;
    return { ...defaultUser, ...parsed };
  } catch {
    return null;
  }
}

function saveToStorageByKey(storageKey, value) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore storage quota/unavailable errors.
  }
}

function removeFromStorageByKey(storageKey) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage quota/unavailable errors.
  }
}

function getUserStorageKey(userId) {
  return `tovaltech_user_user_${userId}`;
}

function mergeProfiles(primary, secondary) {
  const base = { ...defaultUser, ...(secondary || {}), ...(primary || {}) };
  return base;
}

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState(() => loadFromStorage());
  const prevUserIdRef = useRef(undefined);

  const currentUserId = authUser?.id ?? null;
  const activeStorageKey = useMemo(
    () => (currentUserId ? getUserStorageKey(currentUserId) : GUEST_STORAGE_KEY),
    [currentUserId],
  );

  useEffect(() => {
    if (authLoading) return;

    const prevUserId = prevUserIdRef.current;
    const firstInit = prevUserId === undefined;

    if (firstInit) {
      if (currentUserId) {
        const userKey = getUserStorageKey(currentUserId);
        const userProfile = loadFromStorageByKey(userKey);
        const guestProfile = loadFromStorageByKey(GUEST_STORAGE_KEY);
        const merged = mergeProfiles(userProfile, guestProfile);
        setUser(merged);
        saveToStorageByKey(userKey, merged);
      } else {
        setUser(loadFromStorageByKey(GUEST_STORAGE_KEY));
      }
      prevUserIdRef.current = currentUserId;
      return;
    }

    if (prevUserId === currentUserId) return;

    if (prevUserId && !currentUserId) {
      const guest = loadFromStorageByKey(GUEST_STORAGE_KEY);
      const mergedGuest = mergeProfiles(user, guest);
      setUser(mergedGuest);
      saveToStorageByKey(GUEST_STORAGE_KEY, mergedGuest);
      prevUserIdRef.current = currentUserId;
      return;
    }

    if (!prevUserId && currentUserId) {
      const userKey = getUserStorageKey(currentUserId);
      const userProfile = loadFromStorageByKey(userKey);
      const guest = loadFromStorageByKey(GUEST_STORAGE_KEY);
      const merged = mergeProfiles(userProfile, guest);
      setUser(merged);
      saveToStorageByKey(userKey, merged);
      removeFromStorageByKey(GUEST_STORAGE_KEY);
      prevUserIdRef.current = currentUserId;
      return;
    }

    if (prevUserId && currentUserId && prevUserId !== currentUserId) {
      setUser(loadFromStorageByKey(getUserStorageKey(currentUserId)));
      prevUserIdRef.current = currentUserId;
    }
  }, [authLoading, currentUserId, user]);

  // Guarda los datos del usuario en localStorage y en el estado
  const saveUser = useCallback((data) => {
    const merged = { ...defaultUser, ...data };
    saveToStorageByKey(activeStorageKey, merged);
    setUser(merged);
  }, [activeStorageKey]);

  // Borra todos los datos guardados
  const clearUser = useCallback(() => {
    removeFromStorageByKey(activeStorageKey);
    setUser(null);
  }, [activeStorageKey]);

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
