// src/pages/store/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const inputClass =
  'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const ERRORES = {
  nombre_email_password_requeridos: 'Completá nombre, email y contraseña.',
  email_invalido:                   'El email no tiene un formato válido.',
  password_muy_corto:               'La contraseña debe tener al menos 8 caracteres.',
  email_ya_registrado:              'Ese email ya tiene una cuenta. ¿Querés iniciar sesión?',
  internal_error:                   'Error del servidor. Intentá de nuevo en unos minutos.',
};

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', lastName: '', email: '', password: '', password2: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

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
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✉️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Revisá tu email!</h1>
          <p className="text-gray-500 mb-6">
            Te mandamos un link de confirmación a <strong>{form.email}</strong>.<br />
            Hacé click en el link para activar tu cuenta.
          </p>
          <p className="text-sm text-gray-400">
            ¿No llegó? Revisá la carpeta de spam o{' '}
            <button
              onClick={() => setStatus('idle')}
              className="text-blue-600 hover:underline"
            >
              intentá de nuevo
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Crear cuenta</h1>
          <p className="text-gray-500 mt-1 text-sm">
            ¿Ya tenés cuenta?{' '}
            <Link to="/ingresar" className="text-blue-600 hover:underline font-medium">
              Iniciá sesión
            </Link>
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-5 text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={set('name')} required
                  className={inputClass} placeholder="Juan" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Apellido</label>
                <input type="text" value={form.lastName} onChange={set('lastName')}
                  className={inputClass} placeholder="Pérez" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={set('email')} required
                className={inputClass} placeholder="tu@email.com" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
              <input type="password" value={form.password} onChange={set('password')} required
                minLength={8}
                className={inputClass} placeholder="Mínimo 8 caracteres" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Repetir contraseña *</label>
              <input type="password" value={form.password2} onChange={set('password2')} required
                className={inputClass} placeholder="Repetí la contraseña" />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 mt-2"
            >
              {status === 'loading' ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>

          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Al registrarte aceptás nuestros términos de uso.
        </p>

      </div>
    </div>
  );
}
