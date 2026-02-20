// generate-descriptions.js
// Genera descripciones para productos sin descripción usando Ollama (IA local).
// Uso:
//   node generate-descriptions.js --test     (prueba solo 3 productos)
//   node generate-descriptions.js            (procesa todos)

import sql from 'mssql';
import fetch from 'node-fetch';

// ── Configuración DB (igual que en local.settings.json) ──────────────────────
const DB_CONFIG = {
  server:   'tovaltech-db.database.windows.net',
  database: 'free-sql-db-4388942',
  user:     'tovaltech_app',
  password: 'Dra20044196',
  port:     1433,
  options: {
    encrypt:                true,
    trustServerCertificate: false,
    connectTimeout:         30000,
    requestTimeout:         30000,
  },
};

// ── Configuración Ollama ─────────────────────────────────────────────────────
const OLLAMA_URL   = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.2';

// ── Parámetros ───────────────────────────────────────────────────────────────
const TEST_MODE = process.argv.includes('--test');
const BATCH_LIMIT = TEST_MODE ? 3 : 9999;
const DELAY_MS = 500; // pausa entre productos para no saturar

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPrompt(product) {
  const nombre    = product.name     || '';
  const categoria = product.category || '';
  const marca     = product.brand    || '';
  const sku       = product.sku      || '';

  return `Sos un experto en hardware y tecnología con conocimiento profundo de componentes de PC, periféricos y electrónica. Generá una ficha técnica completa para una tienda online argentina.

Producto:
Nombre: ${nombre}
Categoría: ${categoria}
Marca: ${marca}
SKU: ${sku}

Instrucciones:
1. Extraé todas las specs que puedas del nombre del producto.
2. Para las specs que NO estén en el nombre pero que SÍ son estándar o conocidas para ese tipo de producto o modelo, completálas usando tu conocimiento técnico. Por ejemplo: si es DDR5 sabés que el voltaje es 1.1V; si es un cooler con socket AM5 sabés el TDP máximo típico; si es un SSD NVMe M.2 sabés que usa PCIe.
3. NO inventes specs inciertas o que puedan variar mucho entre modelos similares.
4. Escribí cada spec en una línea con el formato exacto: "Especificación: valor"
5. Al final, escribí 1 sola oración indicando para qué tipo de usuario o uso es ideal.
6. NO uses asteriscos, guiones ni Markdown.
7. NO incluyas precio ni stock.
8. Respondé ÚNICAMENTE con las specs y la oración final, sin introducción ni títulos.

Ejemplo de respuesta esperada:
Tipo: DDR5
Capacidad: 16 GB
Velocidad: 5600 MHz
Voltaje: 1.1 V
Factor de forma: UDIMM
Compatibilidad: Intel LGA1700 / AMD AM5
Latencia: CL40
Ideal para armados de alta gama que requieran memoria de última generación con soporte para plataformas Intel y AMD modernas.`;
}

async function generateDescription(product) {
  const prompt = buildPrompt(product);

  const response = await fetch(OLLAMA_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:  OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 200,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const description = (data.response || '').trim();
  return description;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 TovalTech — Generador de descripciones con Ollama`);
  console.log(`   Modo: ${TEST_MODE ? '🧪 TEST (3 productos)' : '🔥 COMPLETO'}`);
  console.log(`   Modelo: ${OLLAMA_MODEL}`);
  console.log('─'.repeat(55));

  // Verificar que Ollama esté corriendo
  console.log('\n🔍 Verificando Ollama...');
  try {
    const check = await fetch('http://localhost:11434/api/tags');
    if (!check.ok) throw new Error('No responde');
    console.log('   ✅ Ollama está corriendo');
  } catch {
    console.error('   ❌ Ollama no está corriendo. Ejecutá: ollama serve');
    process.exit(1);
  }

  // Conectar a la base de datos
  console.log('\n🔗 Conectando a Azure SQL...');
  let pool;
  try {
    pool = await sql.connect(DB_CONFIG);
    console.log('   ✅ Conectado a la base de datos');
  } catch (err) {
    console.error(`   ❌ Error de conexión: ${err.message}`);
    process.exit(1);
  }

  // Obtener productos sin descripción
  console.log('\n📦 Buscando productos sin descripción...');
  const result = await pool.request().query(`
    SELECT TOP ${BATCH_LIMIT} id, name, category, brand, sku
    FROM dbo.tovaltech_products
    WHERE (description IS NULL OR LTRIM(RTRIM(description)) = '')
    ORDER BY id ASC
  `);

  const products = result.recordset;
  const total = products.length;
  console.log(`   📊 Encontrados: ${total} productos para procesar`);

  if (total === 0) {
    console.log('\n🎉 ¡Todos los productos ya tienen descripción!');
    await pool.close();
    return;
  }

  // Estimar tiempo
  const estimadoMin = Math.round((total * 7) / 60);
  console.log(`   ⏱️  Tiempo estimado: ~${estimadoMin} minutos`);
  console.log('\n🤖 Iniciando generación...\n');

  let ok = 0;
  let errores = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const progreso = `[${i + 1}/${total}]`;

    process.stdout.write(`${progreso} ${product.name.substring(0, 50)}... `);

    try {
      const description = await generateDescription(product);

      // Validación básica
      if (!description || description.length < 30) {
        throw new Error('Descripción muy corta o vacía');
      }

      // Guardar en la base de datos
      await pool.request()
        .input('id',          sql.Int,          product.id)
        .input('description', sql.NVarChar(sql.MAX), description)
        .query(`
          UPDATE dbo.tovaltech_products
          SET description = @description
          WHERE id = @id
        `);

      console.log(`✅`);

      if (TEST_MODE) {
        console.log(`\n   📝 Preview: "${description.substring(0, 120)}..."\n`);
      }

      ok++;
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      errores++;
    }

    await sleep(DELAY_MS);
  }

  // Resumen final
  console.log('\n' + '─'.repeat(55));
  console.log(`✅ Completados: ${ok}/${total}`);
  if (errores > 0) console.log(`❌ Errores: ${errores}`);
  console.log('🎉 ¡Proceso finalizado!\n');

  await pool.close();
}

main().catch(err => {
  console.error('💥 Error fatal:', err.message);
  process.exit(1);
});