import { Link } from 'react-router-dom';
import HeroSection from '../../components/store/HeroSection';
import ProductCard from '../../components/store/ProductCard';
import { storeProducts } from '../../data/storeProducts';

export default function Home() {
  const featured = storeProducts.filter(p => p.featured).slice(0, 4);

  const features = [
    { icon: '🚚', title: 'Envío Gratis', desc: 'En compras mayores a $50' },
    { icon: '🔒', title: 'Pago Seguro', desc: 'Transacciones protegidas' },
    { icon: '🔄', title: 'Devoluciones', desc: '30 días para devolver' },
    { icon: '💬', title: 'Soporte 24/7', desc: 'Siempre disponibles' },
  ];

  return (
    <div>
      <HeroSection />

      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-3xl">{f.icon}</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Productos Destacados</h2>
            <p className="text-gray-500 mt-1">Lo más popular de nuestra tienda</p>
          </div>
          <Link to="/productos" className="text-blue-600 hover:text-blue-700 font-medium text-sm">Ver todos →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      <section className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">¿Necesitás algo especial?</h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">Contactanos y te ayudamos a encontrar exactamente lo que buscás.</p>
          <Link to="/contacto" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Contactar Ahora</Link>
        </div>
      </section>
    </div>
  );
}