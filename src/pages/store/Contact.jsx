import { useState } from 'react';

const W3F_KEY = '1ddd9439-8caf-47e3-aaf2-93ce94285b9c';

const INFO = [
  { icon: '📧', bg: 'bg-blue-100',   title: 'Email',     lines: ['valentin@toval-tech.com'] },
  { icon: '📞', bg: 'bg-green-100',  title: 'Teléfono',  lines: ['+54 11 2341-3674', 'Lun-Vie 9:00-18:00'] },
  { icon: '📍', bg: 'bg-purple-100', title: 'Ubicación', lines: ['Buenos Aires, Argentina'] },
  { icon: '⏰', bg: 'bg-yellow-100', title: 'Horario',   lines: ['Lun-Vie: 9:00-18:00', 'Sáb: 10:00-14:00'] },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error

  const h = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const fd = new FormData();
      fd.append('access_key', W3F_KEY);
      fd.append('name',    form.name);
      fd.append('email',   form.email);
      fd.append('subject', form.subject);
      fd.append('message', form.message);

      const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        setForm({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setStatus('idle'), 5000);
      } else {
        throw new Error(data.message || 'Error');
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Contactanos</h1>
        <p className="text-gray-500 mt-2">¿Tenés alguna pregunta? Escribinos y te respondemos a la brevedad.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-6">Información de Contacto</h2>
          <div className="space-y-6">
            {INFO.map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`${item.bg} p-3 rounded-lg text-xl flex-shrink-0`}>{item.icon}</div>
                <div>
                  <p className="font-semibold text-gray-800">{item.title}</p>
                  {item.lines.map((line, j) => <p key={j} className="text-gray-500 text-sm">{line}</p>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
              ✅ ¡Mensaje enviado! Te respondemos pronto a {form.email || 'tu email'}.
            </div>
          )}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              ❌ Error al enviar. Escribinos directamente a valentin@toval-tech.com
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input id="contact-name" type="text" name="name" value={form.name} onChange={h} required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tu nombre" />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="contact-email" type="email" name="email" value={form.email} onChange={h} required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="tu@email.com" />
            </div>
            <div>
              <label htmlFor="contact-subject" className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
              <input id="contact-subject" type="text" name="subject" value={form.subject} onChange={h} required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="¿En qué podemos ayudarte?" />
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
              <textarea id="contact-message" name="message" value={form.message} onChange={h} required rows={5}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Escribí tu mensaje..." />
            </div>
            <button type="submit" disabled={status === 'sending'}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
              {status === 'sending' ? 'Enviando...' : 'Enviar Mensaje'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
