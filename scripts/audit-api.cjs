const { execSync } = require('child_process');

const ALLOWLIST = new Set(['xlsx']);

function runAuditJson() {
  try {
    return execSync('npm --prefix api audit --omit=dev --json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    return err.stdout ? String(err.stdout) : '';
  }
}

function main() {
  const raw = runAuditJson();
  if (!raw) {
    console.error('[audit] No se pudo leer el resultado de npm audit para api/.');
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error('[audit] JSON invalido en npm audit de api/.');
    process.exit(1);
  }

  const vulnerabilities = Object.keys(report.vulnerabilities || {});
  const blocking = vulnerabilities.filter((name) => !ALLOWLIST.has(name));

  if (blocking.length) {
    console.error(`[audit] Vulnerabilidades bloqueantes en api/: ${blocking.join(', ')}`);
    process.exit(1);
  }

  if (vulnerabilities.length) {
    console.warn('[audit] Advertencia: se mantiene vulnerabilidad conocida sin fix en npm para xlsx.');
  }

  console.log('[audit] OK');
}

main();
