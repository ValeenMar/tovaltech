// src/pages/store/ConfirmEmail.jsx
// Página que el usuario ve al hacer click en el link del email de confirmación.
// Lee el ?token= de la URL, llama a /api/auth-confirm y muestra el resultado.

import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const { setUser }    = useAuth();
  const navigate       = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | success | expired | invalid | error

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('invalid');
      return;
    }

    fetch(`/api/auth-confirm?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.ok) {
          setUser(data.user);
          setStatus('success');
          // Redirigir al inicio después de 2.5s
          setTimeout(() => navigate('/', { replace: true }), 2500);
        } else if (data.error === 'token_expirado') {
          setStatus('expired');
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => setStatus('error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">

        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Confirmando tu cuenta...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Cuenta confirmada!</h1>
            <p className="text-gray-500 mb-4">Ya podés comprar en TovalTech. Te redirigimos en un momento...</p>
            <Link to="/" className="text-blue-600 hover:underline text-sm">Ir al inicio ahora</Link>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⏰</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">El link venció</h1>
            <p className="text-gray-500 mb-6">
              El link de confirmación tiene 24 horas de validez. Volvé a registrarte con el mismo email
              y te mandamos uno nuevo.
            </p>
            <Link to="/registrarse"
              className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
              Reenviar confirmación
            </Link>
          </>
        )}

        {(status === 'invalid' || status === 'error') && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {status === 'invalid' ? 'Link inválido' : 'Algo salió mal'}
            </h1>
            <p className="text-gray-500 mb-6">
              {status === 'invalid'
                ? 'Este link no es válido o ya fue utilizado.'
                : 'Hubo un error al confirmar tu cuenta. Intentá de nuevo.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/" className="text-gray-500 hover:underline text-sm">Ir al inicio</Link>
              <span className="text-gray-300">·</span>
              <Link to="/ingresar" className="text-blue-600 hover:underline text-sm">Iniciar sesión</Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
