// src/pages/store/Login.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const inputClass =
  'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const ERRORES = {
  credenciales_incorrectas: 'Email o contraseña incorrectos.',
  email_sin_confirmar:      'Todavía no confirmaste tu email. Revisá tu bandeja de entrada.',
  email_y_password_requeridos: 'Completá email y contraseña.',
  internal_error:           'Error del servidor. Intentá de nuevo.',
};

export default function Login() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();

  // Redirigir a la página de donde vino, o al inicio
  const from = location.state?.from || '/';

  const [form,     setForm]     = useState({ email: '', password: '' });
  const [status,   setStatus]   = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMsg(ERRORES[err?.error] || 'Error inesperado. Intentá de nuevo.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Iniciar sesión</h1>
          <p className="text-gray-500 mt-1 text-sm">
            ¿No tenés cuenta?{' '}
            <Link to="/registrarse" className="text-blue-600 hover:underline font-medium">
              Registrate gratis
            </Link>
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-5 text-sm">
              {errorMsg}
              {errorMsg.includes('confirmaste') && (
                <span>
                  {' '}
                  <Link to="/registrarse" className="underline font-medium">
                    Reenviar confirmación
                  </Link>
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={set('email')} required
                className={inputClass} placeholder="tu@email.com" autoComplete="email" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={form.password} onChange={set('password')} required
                className={inputClass} placeholder="Tu contraseña" autoComplete="current-password" />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {status === 'loading' ? 'Ingresando...' : 'Ingresar'}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}
