import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

export default function Navbar() {
  const { cartCount } = useCart();
  const { pathname } = useLocation();

  const links = [
    { to: '/', label: 'Inicio' },
    { to: '/productos', label: 'Productos' },
    { to: '/contacto', label: 'Contacto' },
  ];

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-bold text-gray-800">TovalTech</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <Link key={l.to} to={l.to} className={`text-sm font-medium transition-colors ${pathname === l.to ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link to="/carrito" className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors">
              <span className="text-xl">🛒</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">{cartCount}</span>
              )}
            </Link>
            <Link to="/admin" className="text-xs text-gray-400 hover:text-gray-600">Admin</Link>
          </div>
        </div>
      </div>

      <div className="md:hidden border-t px-4 py-2 flex gap-4">
        {links.map(l => (
          <Link key={l.to} to={l.to} className={`text-sm ${pathname === l.to ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>{l.label}</Link>
        ))}
      </div>
    </nav>
  );
}