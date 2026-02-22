// src/pages/store/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const inputClass =
  'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white/90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all';

const ERRORES = {
  nombre_email_password_requeridos: 'Completá nombre, email y contraseña.',
  email_invalido:                   'El email no tiene un formato válido.',
  password_muy_corto:               'La contraseña debe tener al menos 8 caracteres.',
  email_ya_registrado:              'Ese email ya tiene una cuenta. ¿Querés iniciar sesión?',
  confirmation_email_failed:        'La cuenta se creó, pero falló el email de confirmación. Probá registrarte otra vez para reenviar el link.',
  auth_schema_missing:              'El sistema de cuentas todavía no está listo. Probá de nuevo en unos minutos.',
  auth_schema_invalid:              'La configuración de cuentas está incompleta. Contactá al administrador.',
  internal_error:                   'Error del servidor. Intentá de nuevo en unos minutos.',
};

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', lastName: '', email: '', password: '', password2: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [successTitle, setSuccessTitle] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.password2) {
      setErrorMsg('Las contraseñas no coinciden.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res  = await fetch('/api/auth-register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     form.name.trim(),
          lastName: form.lastName.trim(),
          email:    form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data?.message === 'registered_ok' || data?.message === 'account_activated') {
          setSuccessTitle('Cuenta lista');
          setSuccessMessage('Tu cuenta ya está activa. Iniciá sesión y empezá a comprar.');
        } else {
          setSuccessTitle('¡Revisá tu email!');
          setSuccessMessage(`Te mandamos un link de confirmación a ${form.email}.`);
        }
        setStatus('success');
      } else {
        setErrorMsg(ERRORES[data.error] || 'Error inesperado. Intentá de nuevo.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('No se pudo conectar con el servidor.');
      setStatus('error');
    }
  };

  // ── Pantalla de éxito ─────────────────────────────────────────────────────
  if (status === 'success') {
    const canLoginNow = successTitle === 'Cuenta lista';
    return (
      <section className="relative overflow-hidden min-h-[70vh] flex items-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,0.16),transparent_38%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.14),transparent_35%)] pointer-events-none" />
        <div className="max-w-lg w-full mx-auto text-center px-4 relative">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">{canLoginNow ? '✅' : '✉️'}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{successTitle}</h1>
          <p className="text-slate-500 mb-6">
            {successMessage}
            {!canLoginNow && (
              <>
                <br />
                Hacé click en el link para activar tu cuenta.
              </>
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/ingresar')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Iniciar sesión
            </button>
            {!canLoginNow && (
              <button
                onClick={() => setStatus('idle')}
                className="text-blue-600 hover:underline font-medium"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(59,130,246,0.14),transparent_42%),radial-gradient(circle_at_88%_85%,rgba(37,99,235,0.1),transparent_30%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-8 items-stretch">
          <aside className="hidden lg:flex rounded-3xl bg-slate-900 text-white p-8 xl:p-10 shadow-xl shadow-slate-900/25 flex-col">
            <span className="inline-flex w-fit text-[11px] tracking-[0.18em] uppercase font-semibold bg-white/10 rounded-full px-3 py-1">
              Crear cuenta
            </span>
            <h1 className="mt-5 text-3xl xl:text-4xl font-bold leading-tight">
              Armá tu perfil y comprá más rápido
            </h1>
            <p className="mt-3 text-slate-300 text-sm leading-relaxed max-w-md">
              Guardá tus datos, seguí pedidos y recibí novedades del catálogo.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Checkout más rápido con tus datos guardados</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Historial completo de tus compras</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">Soporte directo desde tu cuenta</div>
            </div>
            <div className="mt-auto pt-8">
              <p className="text-sm text-slate-300">¿Ya tenés cuenta?</p>
              <Link
                to="/ingresar"
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl transition-colors"
              >
                Iniciar sesión
                <span aria-hidden>→</span>
              </Link>
            </div>
          </aside>

          <div className="bg-white/90 backdrop-blur rounded-3xl shadow-lg border border-slate-100 p-6 sm:p-8 lg:p-9">
            <div className="text-center lg:text-left mb-7">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold">Nuevo cliente</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-800">Crear cuenta</h2>
              <p className="text-slate-500 mt-1 text-sm">
                ¿Ya tenés cuenta?{' '}
                <Link to="/ingresar" className="text-blue-600 hover:underline font-semibold">
                  Iniciá sesión
                </Link>
              </p>
            </div>

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="register-name" className="block text-xs font-semibold text-slate-700 mb-1.5">Nombre *</label>
                  <input
                    id="register-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={set('name')}
                    required
                    className={inputClass}
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label htmlFor="register-lastname" className="block text-xs font-semibold text-slate-700 mb-1.5">Apellido</label>
                  <input
                    id="register-lastname"
                    name="lastName"
                    type="text"
                    value={form.lastName}
                    onChange={set('lastName')}
                    className={inputClass}
                    placeholder="Pérez"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700 mb-1.5">Email *</label>
                <input
                  id="register-email"
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
                <label htmlFor="register-password" className="block text-xs font-semibold text-slate-700 mb-1.5">Contraseña *</label>
                <input
                  id="register-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={8}
                  className={inputClass}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label htmlFor="register-password2" className="block text-xs font-semibold text-slate-700 mb-1.5">Repetir contraseña *</label>
                <input
                  id="register-password2"
                  name="password2"
                  type="password"
                  value={form.password2}
                  onChange={set('password2')}
                  required
                  className={inputClass}
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 mt-2"
              >
                {status === 'loading' ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-4">
              Al registrarte aceptás nuestros términos de uso.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
