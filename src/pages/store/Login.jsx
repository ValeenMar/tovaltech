// src/pages/store/Login.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const inputClass =
  'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white/90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all';

const ERRORES = {
  credenciales_incorrectas: 'Email o contraseña incorrectos.',
  email_sin_confirmar:      'Todavía no confirmaste tu email. Revisá tu bandeja de entrada.',
  email_y_password_requeridos: 'Completá email y contraseña.',
  internal_error:           'Error del servidor. Intentá de nuevo.',
  auth_schema_missing:      'El sistema de cuentas todavía no está listo. Probá de nuevo en unos minutos.',
  auth_schema_invalid:      'La configuración de cuentas está incompleta. Contactá al administrador.',
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
      const code = err?.data?.error || err?.message;
      setErrorMsg(ERRORES[code] || 'Error inesperado. Intentá de nuevo.');
      setStatus('error');
    }
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.14),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(37,99,235,0.12),transparent_35%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-8 items-stretch">
          <aside className="hidden lg:flex rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white p-8 xl:p-10 shadow-xl shadow-blue-900/25 flex-col">
            <span className="inline-flex w-fit text-[11px] tracking-[0.18em] uppercase font-semibold bg-white/15 rounded-full px-3 py-1">
              Clientes TovalTech
            </span>
            <h1 className="mt-5 text-3xl xl:text-4xl font-bold leading-tight">
              Volvé a tu cuenta y seguí comprando sin vueltas
            </h1>
            <p className="mt-3 text-blue-100 text-sm leading-relaxed max-w-md">
              Historial, seguimiento de pedidos y checkout rápido en un solo lugar.
            </p>
            <div className="mt-8 space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">✓</span>
                Tus datos de compra guardados
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">✓</span>
                Seguimiento de pedidos en tiempo real
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">✓</span>
                Soporte técnico desde tu cuenta
              </div>
            </div>
            <div className="mt-auto pt-8">
              <p className="text-sm text-blue-100">¿Primera vez en TovalTech?</p>
              <Link
                to="/registrarse"
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold bg-white text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors"
              >
                Crear cuenta gratis
                <span aria-hidden>→</span>
              </Link>
            </div>
          </aside>

          <div className="bg-white/90 backdrop-blur rounded-3xl shadow-lg border border-slate-100 p-6 sm:p-8 lg:p-9">
            <div className="text-center lg:text-left mb-7">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold">Acceso clientes</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-800">Iniciar sesión</h2>
              <p className="text-slate-500 mt-1 text-sm">
                ¿No tenés cuenta?{' '}
                <Link to="/registrarse" className="text-blue-600 hover:underline font-semibold">
                  Registrate gratis
                </Link>
              </p>
            </div>

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
                {errorMsg}
                {errorMsg.includes('confirmaste') && (
                  <span>
                    {' '}
                    <Link to="/registrarse" className="underline font-semibold">
                      Reenviar confirmación
                    </Link>
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  required
                  className={inputClass}
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">Contraseña</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  required
                  className={inputClass}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
              >
                {status === 'loading' ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
