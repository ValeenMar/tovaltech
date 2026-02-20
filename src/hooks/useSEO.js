// src/hooks/useSEO.js
// Actualiza <title> y <meta name="description"> dinámicamente en cada página.
// Sin dependencias externas — usa document.title directamente.

import { useEffect } from 'react';

const SITE_NAME = 'TovalTech';
const DEFAULT_DESC = 'Tienda de tecnología y computación. Procesadores, placas de video, memorias RAM, almacenamiento, periféricos y más. Envíos a todo el país.';

export function useSEO({ title, description } = {}) {
  useEffect(() => {
    // Título: "Nombre del producto | TovalTech" o solo "TovalTech"
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

    // Meta description
    const desc = description || DEFAULT_DESC;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = desc;

    // Restaurar al salir del componente
    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description]);
}
