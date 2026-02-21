import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProvider } from './context/AppContext'
import './index.css'

// ── Warming de Azure Functions ────────────────────────────────────────────────
// Las Azure Functions en plan consumo entran en "cold start" si no las llamó
// nadie en ~5 minutos. Esto las despierta en background apenas carga la app,
// para que cuando el usuario llegue a la tienda la API ya esté caliente.
// Son fire-and-forget: no bloquean nada, los errores se ignoran silenciosamente.
function warmApis() {
  const ping = (url) => fetch(url, { method: 'GET' }).catch(() => {});
  // Warm-up solo de health y products — banners tiene cache propio
  // y NO va en el warm-up para no aparecer en la cadena crítica de carga de Lighthouse
  setTimeout(() => {
    ping('/api/health');
  }, 800);
  setTimeout(() => {
    ping('/api/products?limit=1');
    ping('/api/products-meta');  // pre-cachear categorías
  }, 1500);
}
warmApis();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
)
