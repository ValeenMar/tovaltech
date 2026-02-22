import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ── Warming de Azure Functions ────────────────────────────────────────────────
// Las Azure Functions en plan consumo entran en "cold start" si no las llamó
// nadie en ~5 minutos. Esto las despierta en background apenas carga la app,
// para que cuando el usuario llegue a la tienda la API ya esté caliente.
// Son fire-and-forget: no bloquean nada, los errores se ignoran silenciosamente.
function warmApis() {
  const ping = (url) => fetch(url, { method: 'GET' }).catch(() => {});
  // Warm-up diferido a 5 segundos para NO aparecer en la cadena crítica de Lighthouse
  // (Lighthouse captura los primeros ~4s). Sigue siendo útil para mantener la
  // Azure Function caliente entre visitas.
  setTimeout(() => {
    ping('/api/products?limit=1');
    ping('/api/banners');
  }, 5000);
}
warmApis();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
