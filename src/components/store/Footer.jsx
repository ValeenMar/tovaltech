import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚡</span>
              <span className="text-xl font-bold text-white">TovalTech</span>
            </div>
            <p className="text-sm text-gray-400 max-w-md">Tu tienda de tecnología de confianza. Productos de calidad, precios competitivos y envío rápido.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">Navegación</h3>
            <div className="flex flex-col gap-2">
              <Link to="/" className="text-sm hover:text-white transition-colors">Inicio</Link>
              <Link to="/productos" className="text-sm hover:text-white transition-colors">Productos</Link>
              <Link to="/carrito" className="text-sm hover:text-white transition-colors">Carrito</Link>
              <Link to="/contacto" className="text-sm hover:text-white transition-colors">Contacto</Link>
            </div>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">Contacto</h3>
            <div className="flex flex-col gap-2 text-sm">
              <span>📧 valentin@toval-tech.com</span>
              <span>📞 +54 11 2341-3674</span>
              <span>📍 Buenos Aires, Argentina</span>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">© 2026 TovalTech. Todos los derechos reservados.</div>
      </div>
    </footer>
  );
}