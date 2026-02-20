// src/pages/store/MisDatos.jsx
// Página donde el cliente puede ver y editar sus datos guardados.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { ZONES } from '../../utils/shipping';

export default function MisDatos() {
  const { user, saveUser, clearUser, hasSavedData } = useUser();

  const [form,    setForm]    = useState(user ?? {
    name: '', lastName: '', email: '', phone: '', zone: 'CABA', address: '', city: '',
  });
  const [saved,   setSaved]   = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (user) setForm(user);
  }, [user]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = () => {
    if (!form.name || !form.email) return;
    saveUser(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = () => {
    clearUser();
    setForm({ name: '', lastName: '', email: '', phone: '', zone: 'CABA', address: '', city: '' });
    setDeleted(true);
    setTimeout(() => setDeleted(false), 2500);
  };

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline mb-3 inline-block">← Inicio</Link>
        <h1 className="text-2xl font-bold text-gray-800">👤 Mis datos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Guardamos tu información en este dispositivo para que no tengas que completarla cada vez que comprás.
        </p>
      </div>

      {/* Banner si no hay datos */}
      {!hasSavedData && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6 text-sm text-blue-700">
          💡 Completá tus datos y guardalos para agilizar el checkout en tu próxima compra.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Nombre y Apellido */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nombre *</label>
            <input value={form.name} onChange={set('name')} placeholder="Juan" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Apellido *</label>
            <input value={form.lastName} onChange={set('lastName')} placeholder="García" className={inputClass} />
          </div>
        </div>

        {/* Email y Teléfono */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="juan@email.com" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Teléfono</label>
            <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+54 9 11 1234-5678" className={inputClass} />
          </div>
        </div>

        {/* Zona */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">Zona de envío habitual</label>
          <div className="grid grid-cols-3 gap-2">
            {ZONES.map(z => (
              <button key={z.value} onClick={() => setForm(f => ({ ...f, zone: z.value }))}
                className={`py-2 rounded-lg text-sm font-medium border-2 transition-all
                  ${form.zone === z.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {z.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dirección */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Dirección</label>
          <input value={form.address} onChange={set('address')} placeholder="Av. Corrientes 1234, Piso 3" className={inputClass} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Ciudad</label>
          <input value={form.city} onChange={set('city')} placeholder="Buenos Aires" className={inputClass} />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={!form.name || !form.email}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all
              ${saved
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed'}`}>
            {saved ? '✅ ¡Guardado!' : 'Guardar mis datos'}
          </button>

          {hasSavedData && (
            <button onClick={handleClear}
              className="px-4 py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-all">
              {deleted ? '✅ Borrado' : 'Borrar datos'}
            </button>
          )}
        </div>

        <p className="text-[11px] text-gray-400 text-center">
          🔒 Tus datos se guardan solo en este dispositivo, nunca los compartimos.
        </p>
      </div>

      {hasSavedData && (
        <div className="mt-5 text-center">
          <Link to="/productos"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700">
            Ir a comprar →
          </Link>
        </div>
      )}
    </div>
  );
}
