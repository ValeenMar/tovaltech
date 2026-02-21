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
  // Pequeño delay para no competir con los recursos críticos de la página
  setTimeout(() => {
    ping('/api/health');
    ping('/api/banners');
  }, 800);
  setTimeout(() => {
    ping('/api/products?limit=1');
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
