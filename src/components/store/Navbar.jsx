// src/components/store/Navbar.jsx
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const CartIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);

const UserIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

// ── Logo TovalTech ─────────────────────────────────────────────────────────────
const TovalTechLogo = () => (
  <div className="flex items-center gap-2.5">
    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="6" height="6" rx="1"/>
        <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>
        <rect x="4" y="4" width="16" height="16" rx="2"/>
      </svg>
    </div>
    <span className="text-lg font-bold tracking-tight text-gray-900">
      Toval<span className="text-blue-600">Tech</span>
    </span>
  </div>
);

export default function Navbar() {
  const { cartCount }        = useCart();
  const { isLogged, authUser, logout } = useAuth();
  const { pathname }         = useLocation();

  const links = [
    { to: '/',          label: 'Inicio' },
    { to: '/productos', label: 'Productos' },
    { to: '/contacto',  label: 'Contacto' },
  ];

  const firstName = authUser?.name?.split(' ')[0] || 'Mi cuenta';

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          <Link to="/">
            <TovalTechLogo />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <Link key={l.to} to={l.to}
                className={`text-sm font-medium transition-colors relative py-1
                  ${pathname === l.to
                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600 after:rounded-full'
                    : 'text-gray-600 hover:text-blue-600'}`}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1">

            {/* Perfil / Auth */}
            {isLogged ? (
              <div className="hidden sm:flex items-center gap-1">
                <Link to="/mis-datos?tab=pedidos"
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  Pedidos
                </Link>
                <Link to="/mis-datos"
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors px-3 py-2 rounded-lg">
                  <UserIcon className="w-4 h-4" />
                  {firstName}
                </Link>
                <button
                  onClick={logout}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Cerrar sesión"
                >
                  Salir
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/ingresar"
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  Ingresar
                </Link>
                <Link to="/registrarse"
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors">
                  Crear cuenta
                </Link>
              </div>
            )}

            {/* Carrito */}
            <Link to="/carrito"
              aria-label="Ver carrito de compras"
              className="relative p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
              <CartIcon className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center rounded-full font-bold leading-none px-1">
                  {cartCount}
                </span>
              )}
            </Link>

          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-gray-100 px-4 py-2 flex gap-6">
        {links.map(l => (
          <Link key={l.to} to={l.to}
            className={`text-sm py-1 ${pathname === l.to ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
            {l.label}
          </Link>
        ))}
        {isLogged ? (
          <div className="ml-auto flex items-center gap-3">
            <Link to="/mis-datos?tab=pedidos" className="text-sm text-gray-500">Pedidos</Link>
            <Link to="/mis-datos" className="text-sm text-blue-600 flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5" />
              {firstName}
            </Link>
            <button onClick={logout} className="text-sm text-gray-400">Salir</button>
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-3">
            <Link to="/ingresar" className="text-sm text-gray-500">Ingresar</Link>
            <Link to="/registrarse" className="text-sm font-semibold text-blue-600">Registrarse</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
