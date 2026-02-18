import { useState } from 'react'

function Toggle({ defaultOn = false }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div onClick={() => setOn(!on)} className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors shrink-0 ${on ? 'bg-azure-500' : 'bg-gray-300'}`}>
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : ''}`} />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 mb-4">
      <h3 className="font-semibold text-base mb-4 pb-3 border-b border-gray-200">{title}</h3>
      {children}
    </div>
  )
}

function Row({ title, desc, children }) {
  return (
    <div className="flex justify-between items-center py-3 gap-3 border-b border-gray-100 last:border-0">
      <div><h4 className="text-sm font-medium">{title}</h4><p className="text-xs text-gray-400">{desc}</p></div>
      {children}
    </div>
  )
}

export default function Settings() {
  return (
    <>
      <Section title="⚙️ General">
        <Row title="Nombre de la tienda" desc="AzurePanel E-Commerce">
          <button className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50">Editar</button>
        </Row>
        <Row title="Zona horaria" desc="America/Mexico_City (UTC-6)">
          <button className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50">Cambiar</button>
        </Row>
        <Row title="Moneda" desc="USD — Dólar estadounidense">
          <button className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50">Cambiar</button>
        </Row>
      </Section>

      <Section title="🔔 Notificaciones">
        <Row title="Email por nuevo pedido" desc="Azure Communication Services"><Toggle defaultOn /></Row>
        <Row title="Alerta de stock bajo" desc="Notificar cuando stock < 5"><Toggle defaultOn /></Row>
        <Row title="Resumen semanal" desc="Reporte cada lunes"><Toggle /></Row>
      </Section>

      <Section title="🔐 Seguridad (Azure AD B2C)">
        <Row title="Autenticación multifactor" desc="Requerir MFA para admins"><Toggle defaultOn /></Row>
        <Row title="Proveedores sociales" desc="Google, Microsoft, Facebook">
          <button className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50">Configurar</button>
        </Row>
      </Section>

      <Section title="🏗️ Stack del proyecto">
        <div className="text-sm leading-8">
          <div>⚛️ <strong>Frontend:</strong> React + Vite + TailwindCSS</div>
          <div>🔗 <strong>Backend:</strong> Azure Static Web Apps API (integrado, /api)</div>
          <div>🗄️ <strong>Base de datos:</strong> Azure SQL</div>
          <div>🌐 <strong>Hosting:</strong> Azure Static Web Apps (gratis)</div>
          <div>🔐 <strong>Auth:</strong> Azure AD B2C (50K gratis)</div>
          <div>📁 <strong>Archivos:</strong> Azure Blob Storage</div>
          <div>📧 <strong>Emails:</strong> Azure Communication Services</div>
          <div>💛 <strong>Lenguaje:</strong> 100% JavaScript punta a punta</div>
        </div>
      </Section>
    </>
  )
}