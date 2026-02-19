import { Link } from 'react-router-dom';

export default function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 text-8xl">⚡</div>
        <div className="absolute top-32 right-20 text-6xl">💻</div>
        <div className="absolute bottom-20 left-1/3 text-7xl">🎧</div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative">
        <div className="max-w-2xl">
          <span className="inline-block bg-white/20 backdrop-blur-sm text-sm font-medium px-4 py-1 rounded-full mb-6">🚀 Nuevos productos disponibles</span>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">Tecnología que <span className="text-yellow-300">impulsa</span> tu día</h1>
          <p className="text-lg md:text-xl text-blue-100 mb-8">Descubrí los mejores productos tech con envío rápido, garantía extendida y los mejores precios.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/productos" className="bg-white text-blue-700 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-all shadow-lg">Ver Productos</Link>
            <Link to="/contacto" className="border-2 border-white/30 px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-all">Contactanos</Link>
          </div>
        </div>
      </div>
    </section>
  );
}