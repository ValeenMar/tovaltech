import { Outlet, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';

export default function AdminLayout() {
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
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="animate-spin text-4xl">⚙️</div>
      </div>
    );
  }

  // No logueado o sin rol admin → redirige al login de Microsoft
  if (status === 'unauthorized') {
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=/admin';
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
