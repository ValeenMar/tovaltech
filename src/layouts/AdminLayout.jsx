import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { useApp } from '../context/AppContext';

export default function AdminLayout() {
  const location = useLocation();
  const { adminTheme } = useApp();
  const [status, setStatus] = useState('checking'); // checking | ok | unauthorized

  useEffect(() => {
    fetch('/.auth/me')
      .then(r => r.ok ? r.json() : { clientPrincipal: null })
      .then(data => {
        const principal = data?.clientPrincipal;
        const isAdmin   = principal?.userRoles?.includes('admin');
        setStatus(isAdmin ? 'ok' : 'unauthorized');
      })
      .catch(() => setStatus('unauthorized'));
  }, []);

  // Mientras verifica, pantalla en blanco (evita flash de contenido)
  if (status === 'checking') {
    return (
      <div className="admin-shell flex h-screen items-center justify-center px-4">
        <div className="admin-surface rounded-3xl px-8 py-8 text-center w-full max-w-sm">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-xl flex items-center justify-center shadow-lg">
            ✨
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-800">Cargando TovalTech Admin</h2>
          <p className="mt-1 text-sm text-slate-500">Inicializando sesión y permisos</p>
          <div className="mt-5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-blue-500 to-cyan-400 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // No logueado o sin rol admin → redirige al login de Microsoft
  if (status === 'unauthorized') {
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=/admin';
    return null;
  }

  return (
    <div className={`admin-shell h-screen overflow-hidden admin-theme-${adminTheme}`}>
      <div className="admin-bg-grid" />
      <div className="relative z-10 flex h-full">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main key={location.pathname} className="admin-main flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <div className="admin-content-enter mx-auto w-full max-w-[1480px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
