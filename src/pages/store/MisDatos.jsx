import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';
import { ZONES } from '../../utils/shipping';

const STATUS_UI = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Pagado', className: 'bg-blue-100 text-blue-700' },
  shipped: { label: 'En camino', className: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Entregado', className: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', className: 'bg-rose-100 text-rose-700' },
};
const ORDER_STEPS = [
  { id: 'pending', label: 'Recibido' },
  { id: 'paid', label: 'Pagado' },
  { id: 'shipped', label: 'En camino' },
  { id: 'delivered', label: 'Entregado' },
];

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function getStatusStep(status) {
  if (status === 'cancelled') return -1;
  const idx = ORDER_STEPS.findIndex((step) => step.id === status);
  return idx >= 0 ? idx : 0;
}

function OrderCard({ order }) {
  const status = STATUS_UI[order.status] || STATUS_UI.pending;
  const stepIndex = getStatusStep(order.status);
  const items = Array.isArray(order.items) ? order.items : [];
  const visibleItems = items.filter((it) => String(it.id || '').toLowerCase() !== 'shipping');
  const units = visibleItems.reduce((acc, item) => acc + Number(item.quantity || 0), 0);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400 font-semibold">
            Pedido #{order.id}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">
            {fmtDate(order.created_at)} · {units} unidad{units !== 1 ? 'es' : ''}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {visibleItems.slice(0, 4).map((item, idx) => (
          <div key={`${item.id}-${idx}`} className="flex items-center justify-between text-sm gap-2">
            <span className="text-slate-600 truncate">
              {item.title || 'Producto'} <span className="text-slate-400">x{item.quantity || 1}</span>
            </span>
            <span className="font-semibold text-slate-700">
              {fmtARS((Number(item.unit_price || 0)) * (Number(item.quantity || 1)))}
            </span>
          </div>
        ))}
        {visibleItems.length > 4 && (
          <p className="text-xs text-slate-400">+{visibleItems.length - 4} producto(s) más</p>
        )}
      </div>

      {stepIndex === -1 ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Este pedido fue cancelado. Si necesitás ayuda, escribinos desde contacto.
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400 font-semibold mb-2">
            Seguimiento del pedido
          </p>
          <div className="grid grid-cols-4 gap-2">
            {ORDER_STEPS.map((step, idx) => {
              const active = idx <= stepIndex;
              return (
                <div key={step.id} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-blue-600' : 'bg-slate-300'}`} />
                    {idx < ORDER_STEPS.length - 1 && (
                      <span className={`h-[2px] w-6 sm:w-8 rounded ${idx < stepIndex ? 'bg-blue-600' : 'bg-slate-300'}`} />
                    )}
                  </div>
                  <p className={`text-[10px] font-semibold ${active ? 'text-blue-700' : 'text-slate-400'}`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-sm text-slate-500">Total</span>
        <span className="text-base font-bold text-blue-700">{fmtARS(order.total_ars)}</span>
      </div>
    </article>
  );
}

export default function MisDatos() {
  const { user, saveUser, clearUser, hasSavedData } = useUser();
  const { isLogged } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(() => (
    searchParams.get('tab') === 'pedidos' ? 'pedidos' : 'perfil'
  ), [searchParams]);

  const [form, setForm] = useState(user ?? {
    name: '', lastName: '', email: '', phone: '', zone: 'CABA', address: '', city: '',
  });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | ok | error
  const [saveMsg, setSaveMsg] = useState('');

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  useEffect(() => {
    if (user) setForm(user);
  }, [user]);

  useEffect(() => {
    if (!isLogged) return;
    let cancelled = false;

    const run = async () => {
      setLoadingProfile(true);
      try {
        const res = await fetch('/api/account-profile', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.ok || !data.profile || cancelled) return;
        setForm(data.profile);
        saveUser(data.profile);
      } catch {
        // Silent fallback.
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [isLogged, saveUser]);

  useEffect(() => {
    if (activeTab !== 'pedidos' || !isLogged) return;
    let cancelled = false;

    const run = async () => {
      setOrdersLoading(true);
      setOrdersError('');
      try {
        const res = await fetch('/api/my-orders?limit=30', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!cancelled) setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch (err) {
        if (!cancelled) setOrdersError('No pudimos cargar tus pedidos en este momento.');
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [activeTab, isLogged]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name?.trim() || !form.lastName?.trim() || !form.email?.trim()) {
      setSaveState('error');
      setSaveMsg('Completá nombre, apellido y email.');
      return;
    }

    saveUser(form);
    if (!isLogged) {
      setSaveState('ok');
      setSaveMsg('Datos guardados en este dispositivo.');
      return;
    }

    setSaveState('saving');
    setSaveMsg('');
    try {
      const res = await fetch('/api/account-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (data?.ok && data.profile) {
        setForm(data.profile);
        saveUser(data.profile);
      }
      setSaveState('ok');
      setSaveMsg('Perfil actualizado correctamente.');
    } catch {
      setSaveState('error');
      setSaveMsg('No se pudo actualizar tu perfil de cuenta.');
    }
  };

  const handleClear = () => {
    clearUser();
    setForm({ name: '', lastName: '', email: '', phone: '', zone: 'CABA', address: '', city: '' });
    setSaveState('ok');
    setSaveMsg('Datos locales borrados.');
  };

  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline mb-3 inline-block">← Inicio</Link>
        <h1 className="text-3xl font-bold text-slate-800">Mi cuenta</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gestioná tus datos, revisá tus pedidos y mantené tu perfil actualizado.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 mb-6">
        <button
          onClick={() => setSearchParams({ tab: 'perfil' })}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'perfil' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Perfil
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'pedidos' })}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'pedidos' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Mis pedidos
        </button>
      </div>

      {activeTab === 'perfil' && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          {loadingProfile && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
              Sincronizando datos de tu cuenta...
            </div>
          )}

          {!hasSavedData && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
              Completá tus datos para acelerar futuras compras.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-name" className="block text-xs font-semibold text-slate-500 mb-1.5">Nombre *</label>
              <input id="profile-name" value={form.name} onChange={set('name')} placeholder="Juan" className={inputClass} />
            </div>
            <div>
              <label htmlFor="profile-lastname" className="block text-xs font-semibold text-slate-500 mb-1.5">Apellido *</label>
              <input id="profile-lastname" value={form.lastName} onChange={set('lastName')} placeholder="García" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-email" className="block text-xs font-semibold text-slate-500 mb-1.5">Email *</label>
              <input id="profile-email" type="email" value={form.email} onChange={set('email')} placeholder="juan@email.com" className={inputClass} />
            </div>
            <div>
              <label htmlFor="profile-phone" className="block text-xs font-semibold text-slate-500 mb-1.5">Teléfono</label>
              <input id="profile-phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+54 9 11 1234-5678" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Zona de envío habitual</label>
            <div className="grid grid-cols-3 gap-2">
              {ZONES.map((z) => (
                <button
                  key={z.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, zone: z.value }))}
                  className={`py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    form.zone === z.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="profile-address" className="block text-xs font-semibold text-slate-500 mb-1.5">Dirección</label>
            <input id="profile-address" value={form.address} onChange={set('address')} placeholder="Av. Corrientes 1234, Piso 3" className={inputClass} />
          </div>

          <div>
            <label htmlFor="profile-city" className="block text-xs font-semibold text-slate-500 mb-1.5">Ciudad</label>
            <input id="profile-city" value={form.city} onChange={set('city')} placeholder="Buenos Aires" className={inputClass} />
          </div>

          {saveMsg && (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                saveState === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              }`}
            >
              {saveMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {saveState === 'saving' ? 'Guardando...' : 'Guardar perfil'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-5 py-3 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition-colors"
            >
              Borrar datos locales
            </button>
            <Link
              to="/productos"
              className="ml-auto px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Ir a comprar
            </Link>
          </div>
        </section>
      )}

      {activeTab === 'pedidos' && (
        <section>
          {!isLogged ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
              <h2 className="text-xl font-bold text-slate-800">Iniciá sesión para ver tus pedidos</h2>
              <p className="text-sm text-slate-500 mt-2">
                Tu historial de compras y estado de entrega están disponibles solo con cuenta activa.
              </p>
              <Link
                to="/ingresar"
                className="inline-flex mt-5 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Ingresar
              </Link>
            </div>
          ) : ordersLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
              Cargando pedidos...
            </div>
          ) : ordersError ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
              {ordersError}
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
              <p className="text-slate-500">Todavía no tenés pedidos registrados con esta cuenta.</p>
              <Link
                to="/productos"
                className="inline-flex mt-4 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Ver productos
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
