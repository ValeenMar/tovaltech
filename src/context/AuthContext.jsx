// src/context/AuthContext.jsx
// Maneja la sesión autenticada del comprador (JWT en cookie HttpOnly).
// Coexiste con UserContext (que guarda datos de checkout en localStorage).

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authUser, setAuthUser]   = useState(null);   // null = no logueado
  const [loading,  setLoading]    = useState(true);   // true mientras verifica sesión al arrancar

  // ── Al montar: verificar si hay sesión activa ─────────────────────────────
  useEffect(() => {
    fetch('/api/auth-me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ok) setAuthUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res  = await fetch('/api/auth-login', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) throw data; // { error: 'credenciales_incorrectas' | 'email_sin_confirmar' }

    setAuthUser(data.user);
    return data.user;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await fetch('/api/auth-logout', { method: 'POST', credentials: 'include' });
    setAuthUser(null);
  }, []);

  // ── Después de confirmar email, actualizar estado ─────────────────────────
  const setUser = useCallback((user) => setAuthUser(user), []);

  const isLogged = Boolean(authUser);

  return (
    <AuthContext.Provider value={{ authUser, isLogged, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
