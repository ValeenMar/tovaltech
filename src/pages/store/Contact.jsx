import { useState } from 'react';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 3000);
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  const h = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const info = [
    { icon: '📧', bg: 'bg-blue-100', title: 'Email', lines: ['info@tovaltech.com', 'soporte@tovaltech.com'] },
    { icon: '📞', bg: 'bg-green-100', title: 'Teléfono', lines: ['+1 (555) 123-4567', 'Lun-Vie 8am-6pm'] },
    { icon: '📍', bg: 'bg-purple-100', title: 'Ubicación', lines: ['San José, Costa Rica'] },
    { icon: '⏰', bg: 'bg-yellow-100', title: 'Horario', lines: ['Lun-Vie: 8:00-18:00', 'Sáb: 9:00-13:00'] },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Contactanos</h1>
        <p className="text-gray-500 mt-2">¿Tenés alguna pregunta? Escribinos y te respondemos pronto.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-6">Información de Contacto</h2>
          <div className="space-y-6">
            {info.map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`${item.bg} p-3 rounded-lg text-xl`}>{item.icon}</div>
                <div>
                  <p className="font-semibold text-gray-800">{item.title}</p>
                  {item.lines.map((line, j) => <p key={j} className="text-gray-500 text-sm">{line}</p>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          {sent && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">✅ Mensaje enviado correctamente.</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" name="name" value={form.name} onChange={h} required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tu nombre" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={h} required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="tu@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
              <input type="text" name="subject" value={form.subject} onChange={h} required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="¿En qué podemos ayudarte?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
              <textarea name="message" value={form.message} onChange={h} required rows={5} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Escribí tu mensaje..." />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Enviar Mensaje</button>
          </form>
        </div>
      </div>
    </div>
  );
}