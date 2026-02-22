// generate-descriptions.mjs
// Regenera descripciones estructuradas para productos.
// Soporta OpenAI (default) y Ollama.
//
// Uso:
//   node generate-descriptions.mjs --test
//   node generate-descriptions.mjs --rewrite-all --provider=openai --limit=300
//   node generate-descriptions.mjs --rewrite-all --category="PLACA DE VIDEO" --dry-run

import sql from 'mssql';
import fetch from 'node-fetch';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return value.trim();
}

function readArg(argv, prefix) {
  const entry = argv.find((item) => item.startsWith(prefix));
  if (!entry) return '';
  return entry.slice(prefix.length).trim();
}

function toPositiveInt(rawValue, fieldName) {
  const value = Number.parseInt(String(rawValue), 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} invalido: ${rawValue}`);
  }
  return value;
}

function parseArgs(argv) {
  const testMode = argv.includes('--test');
  const rewriteAll = argv.includes('--rewrite-all');
  const dryRun = argv.includes('--dry-run');

  const providerRaw = (readArg(argv, '--provider=') || 'openai').toLowerCase();
  if (!['openai', 'ollama'].includes(providerRaw)) {
    throw new Error(`--provider invalido: ${providerRaw} (usar: openai|ollama)`);
  }

  const limitRaw = readArg(argv, '--limit=');
  const delayRaw = readArg(argv, '--delay-ms=');
  const categoryFilter = readArg(argv, '--category=');

  const batchLimit = limitRaw ? toPositiveInt(limitRaw, '--limit') : (testMode ? 3 : 9999);
  const delayMs = delayRaw ? toPositiveInt(delayRaw, '--delay-ms') : 700;

  return {
    provider: providerRaw,
    testMode,
    rewriteAll,
    dryRun,
    batchLimit,
    delayMs,
    categoryFilter,
  };
}

const ARGS = parseArgs(process.argv.slice(2));

function getDbConfig() {
  const portRaw = process.env.DB_PORT || '1433';
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port)) {
    throw new Error(`DB_PORT invalido: ${portRaw}`);
  }

  return {
    server: requireEnv('DB_SERVER'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port,
    options: {
      encrypt: true,
      trustServerCertificate: false,
      connectTimeout: 30000,
      requestTimeout: 30000,
    },
  };
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const DEFAULT_SPEC_LABELS = [
  'Tipo de producto',
  'Modelo',
  'Capacidad/Formato',
  'Interfaz/Conectividad',
  'Compatibilidad',
  'Caracteristica principal',
  'Caracteristica adicional',
  'Garantia',
];

const TEMPLATE_RULES = [
  {
    name: 'gpu',
    match: /PLACA DE VIDEO|GRAPHICS|VGA|GPU/i,
    labels: [
      'Modelo GPU',
      'Memoria de video',
      'Tipo de memoria',
      'Interfaz',
      'Salidas de video',
      'Conectores de energia',
      'Refrigeracion',
      'Largo de placa',
    ],
  },
  {
    name: 'cpu',
    match: /PROCESADOR|CPU|RYZEN|CORE I[3579]|PENTIUM|CELERON/i,
    labels: [
      'Familia',
      'Modelo',
      'Nucleos/Hilos',
      'Frecuencia',
      'Socket',
      'Graficos integrados',
      'Cache',
      'TDP',
    ],
  },
  {
    name: 'ram',
    match: /MEMORIA|RAM|DDR[345]/i,
    labels: [
      'Tipo de memoria',
      'Capacidad',
      'Velocidad',
      'Latencia',
      'Voltaje',
      'Formato',
      'Perfil XMP/EXPO',
      'Compatibilidad',
    ],
  },
  {
    name: 'ssd-hdd',
    match: /SSD|NVME|M\.2|DISCO|HDD|SATA/i,
    labels: [
      'Tipo de unidad',
      'Capacidad',
      'Formato',
      'Interfaz',
      'Lectura secuencial',
      'Escritura secuencial',
      'Durabilidad/TBW',
      'Disipador',
    ],
  },
  {
    name: 'motherboard',
    match: /MOTHER|MOTHERBOARD|MAINBOARD|B650|Z790|A620|H610|X670/i,
    labels: [
      'Socket',
      'Chipset',
      'Formato',
      'Memoria soportada',
      'Slots de expansion',
      'Almacenamiento',
      'Red y conectividad',
      'Puertos traseros',
    ],
  },
  {
    name: 'psu',
    match: /FUENTE|PSU|POWER SUPPLY|80\+|ATX/i,
    labels: [
      'Potencia',
      'Certificacion',
      'Formato',
      'Tipo de cableado',
      'Conectores',
      'Protecciones',
      'Ventilador',
      'Voltaje de entrada',
    ],
  },
  {
    name: 'monitor',
    match: /MONITOR|DISPLAY|PULGADAS|HZ/i,
    labels: [
      'Tamano',
      'Resolucion',
      'Panel',
      'Tasa de refresco',
      'Tiempo de respuesta',
      'Sincronizacion',
      'Entradas de video',
      'Montaje VESA',
    ],
  },
  {
    name: 'notebook',
    match: /NOTEBOOK|LAPTOP|PORTATIL/i,
    labels: [
      'Procesador',
      'Memoria RAM',
      'Almacenamiento',
      'Pantalla',
      'Graficos',
      'Conectividad',
      'Bateria',
      'Sistema operativo',
    ],
  },
  {
    name: 'mouse-keyboard-headset',
    match: /MOUSE|TECLADO|KEYBOARD|AURICULAR|HEADSET/i,
    labels: [
      'Tipo de periferico',
      'Conexion',
      'Switch/Sensor',
      'Iluminacion',
      'Compatibilidad',
      'Autonomia',
      'Materiales',
      'Funciones extra',
    ],
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getTemplate(product) {
  const haystack = `${product.category || ''} ${product.name || ''}`.toUpperCase();
  const found = TEMPLATE_RULES.find((rule) => rule.match.test(haystack));
  if (found) return { name: found.name, labels: found.labels };
  return { name: 'default', labels: DEFAULT_SPEC_LABELS };
}

function buildPromptMessages(product, template) {
  const labelsList = template.labels.map((label) => `- ${label}`).join('\n');
  const productPayload = {
    name: product.name || '',
    category: product.category || '',
    brand: product.brand || '',
    sku: product.sku || '',
    warranty: product.warranty || '',
  };

  const system = [
    'Sos especialista en catalogo tecnico de ecommerce para hardware y tecnologia.',
    'Respuesta obligatoria: JSON valido, sin markdown ni texto fuera de JSON.',
    'Formato exacto:',
    '{"specs":{"<label>":"<value>"},"ideal_para":"<oracion>"}',
    'Reglas:',
    '1) Usa solo informacion explicita del producto de entrada.',
    '2) Si un dato no aparece de forma clara, responder "No especificado".',
    '3) No inventar numeros tecnicos (TDP, frecuencias, sockets, puertos, medidas, etc.).',
    '4) Completar exactamente las etiquetas solicitadas.',
    '5) Cada valor debe ser corto (maximo 60 caracteres).',
    '6) ideal_para debe tener 12-24 palabras y describir uso real.',
    '7) No incluir precio ni stock.',
  ].join('\n');

  const user = [
    'Completa estas etiquetas exactamente:',
    labelsList,
    '',
    `Template: ${template.name}`,
    `Producto: ${JSON.stringify(productPayload)}`,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function extractJsonObject(rawText) {
  const text = cleanText(rawText);
  if (!text) throw new Error('Respuesta vacia del modelo');

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new Error('No se pudo parsear JSON de la respuesta');
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}

function sanitizeSpecValue(value) {
  const clean = cleanText(value);
  if (!clean) return 'No especificado';

  const invalid = /^(n\/a|na|null|none|unknown|desconocido|sin datos|no aplica)$/i;
  if (invalid.test(clean)) return 'No especificado';

  if (clean.length > 60) {
    return `${clean.slice(0, 57).trim()}...`;
  }
  return clean;
}

function sanitizeIdealPara(value, product) {
  const clean = cleanText(value);
  if (!clean) {
    const category = cleanText(product.category || 'hardware').toLowerCase();
    return `Ideal para usuarios que buscan ${category} confiable para trabajo, estudio o entretenimiento segun su configuracion.`;
  }

  const withoutLineBreaks = clean.replace(/\n/g, ' ');
  if (withoutLineBreaks.length <= 180) return withoutLineBreaks;
  return `${withoutLineBreaks.slice(0, 177).trim()}...`;
}

function normalizeSpecs(payload, template, product) {
  const rawMap = new Map();
  const specs = payload && typeof payload === 'object' ? payload.specs : null;

  if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
    for (const [key, value] of Object.entries(specs)) {
      rawMap.set(normalizeKey(key), sanitizeSpecValue(value));
    }
  }

  if (Array.isArray(specs)) {
    for (const row of specs) {
      if (!row || typeof row !== 'object') continue;
      const key = normalizeKey(row.label || row.key || '');
      if (!key) continue;
      rawMap.set(key, sanitizeSpecValue(row.value));
    }
  }

  const normalized = {};
  for (const label of template.labels) {
    const value = rawMap.get(normalizeKey(label)) || 'No especificado';
    normalized[label] = sanitizeSpecValue(value);
  }

  const idealPara = sanitizeIdealPara(
    payload?.ideal_para || payload?.idealPara || payload?.ideal_for || '',
    product
  );

  return { normalized, idealPara };
}

function renderDescription(specsByLabel, template, idealPara) {
  const lines = template.labels.map((label) => `${label}: ${specsByLabel[label] || 'No especificado'}`);
  lines.push(`Ideal para: ${idealPara}`);
  return lines.join('\n');
}

async function generateWithOpenAI(product, template) {
  const apiKey = requireEnv('OPENAI_API_KEY');
  const messages = buildPromptMessages(product, template);

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${body.slice(0, 220)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI devolvio respuesta vacia');

  return extractJsonObject(content);
}

async function generateWithOllama(product, template) {
  const messages = buildPromptMessages(product, template);
  const flattened = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n');

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: flattened,
      stream: false,
      options: {
        temperature: 0.15,
        num_predict: 320,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return extractJsonObject(data?.response || '');
}

function buildSelectQuery(limit, rewriteAll, hasCategoryFilter) {
  const whereConditions = [];
  if (!rewriteAll) {
    whereConditions.push("(description IS NULL OR LTRIM(RTRIM(description)) = '')");
  }
  if (hasCategoryFilter) {
    whereConditions.push('UPPER(category) = UPPER(@category)');
  }

  const whereClause = whereConditions.length
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  return `
    SELECT TOP (${limit}) id, name, category, brand, sku, warranty
    FROM dbo.tovaltech_products
    ${whereClause}
    ORDER BY id ASC
  `;
}

async function withRetry(task, maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const waitMs = 800 * attempt;
      process.stdout.write(`(retry ${attempt}/${maxAttempts - 1}) `);
      await sleep(waitMs);
    }
  }
  throw lastError;
}

async function ensureProviderReady() {
  if (ARGS.provider === 'openai') {
    requireEnv('OPENAI_API_KEY');
    return;
  }

  const check = await fetch('http://localhost:11434/api/tags');
  if (!check.ok) {
    throw new Error('Ollama no responde en http://localhost:11434');
  }
}

async function main() {
  console.log('\nTovalTech - Generador estructurado de descripciones');
  console.log(`Provider: ${ARGS.provider}`);
  if (ARGS.provider === 'openai') {
    console.log(`Model: ${OPENAI_MODEL}`);
  } else {
    console.log(`Model: ${OLLAMA_MODEL}`);
  }
  console.log(`Modo test: ${ARGS.testMode ? 'si' : 'no'}`);
  console.log(`Rewrite all: ${ARGS.rewriteAll ? 'si' : 'no'}`);
  console.log(`Dry run: ${ARGS.dryRun ? 'si' : 'no'}`);
  console.log(`Limit: ${ARGS.batchLimit}`);
  if (ARGS.categoryFilter) console.log(`Category filter: ${ARGS.categoryFilter}`);

  await ensureProviderReady();

  console.log('\nConectando a Azure SQL...');
  const pool = await sql.connect(getDbConfig());
  console.log('Conexion OK');

  const query = buildSelectQuery(ARGS.batchLimit, ARGS.rewriteAll, Boolean(ARGS.categoryFilter));
  const request = pool.request();
  if (ARGS.categoryFilter) {
    request.input('category', sql.NVarChar(120), ARGS.categoryFilter);
  }

  console.log('\nBuscando productos...');
  const result = await request.query(query);
  const products = result.recordset || [];
  const total = products.length;
  console.log(`Encontrados: ${total}`);

  if (total === 0) {
    console.log('No hay productos para procesar.');
    await pool.close();
    return;
  }

  let ok = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const product = products[i];
    const progress = `[${i + 1}/${total}]`;
    const template = getTemplate(product);
    const shortName = cleanText(product.name).slice(0, 55);

    process.stdout.write(`${progress} (${template.name}) ${shortName}... `);

    try {
      const payload = await withRetry(async () => {
        if (ARGS.provider === 'openai') {
          return generateWithOpenAI(product, template);
        }
        return generateWithOllama(product, template);
      }, 3);

      const { normalized, idealPara } = normalizeSpecs(payload, template, product);
      const description = renderDescription(normalized, template, idealPara);

      if (!description || description.length < 80) {
        throw new Error('Descripcion resultante demasiado corta');
      }

      if (!ARGS.dryRun) {
        await pool.request()
          .input('id', sql.Int, product.id)
          .input('description', sql.NVarChar(sql.MAX), description)
          .query(`
            UPDATE dbo.tovaltech_products
            SET description = @description
            WHERE id = @id
          `);
      } else {
        skipped++;
      }

      console.log('OK');

      if (ARGS.testMode || ARGS.dryRun) {
        console.log(`  Preview:\n${description}\n`);
      }

      ok++;
    } catch (error) {
      errors++;
      console.log(`ERROR: ${error.message}`);
    }

    await sleep(ARGS.delayMs);
  }

  console.log('\nResumen');
  console.log(`OK: ${ok}`);
  console.log(`Errores: ${errors}`);
  if (ARGS.dryRun) console.log(`Dry-run (sin escribir DB): ${skipped}`);

  await pool.close();
}

main().catch((error) => {
  console.error('\nError fatal:', error.message);
  process.exit(1);
});
