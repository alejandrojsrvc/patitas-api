import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env.dist'], quiet: true });

const KEY_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,127}$/;
const MAX_KEYS = 100;

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Error desconocido.' }));
  process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  const valuesFor = (name) => args.flatMap((value, index) => (value === name && args[index + 1] ? [args[index + 1]] : []));
  const valueFor = (name) => valuesFor(name)[0];
  const requestedKeys = valuesFor('--xkey');
  const scope = valueFor('--scope');
  const slug = valueFor('--slug');
  const keys = normalizeKeys([...requestedKeys, ...keysForScope(scope ?? (requestedKeys.length ? undefined : 'catalog'), slug)]);

  if (!keys.length) throw new Error('Indicá al menos un --xkey o --scope.');
  if (keys.length > MAX_KEYS) throw new Error(`No se pueden purgar más de ${MAX_KEYS} XKeys por operación.`);

  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ ok: true, dryRun: true, keys }));
    return;
  }

  const varnish = await purgeVarnish(requiredEnv('VARNISH_PURGE_URL'), requiredEnv('VARNISH_PURGE_SECRET'), keys);
  const cloudflareZoneId = optionalEnv('CLOUDFLARE_ZONE_ID');
  const cloudflareToken = optionalEnv('CLOUDFLARE_CACHE_PURGE_TOKEN');
  if (Boolean(cloudflareZoneId) !== Boolean(cloudflareToken)) {
    throw new Error('CLOUDFLARE_ZONE_ID y CLOUDFLARE_CACHE_PURGE_TOKEN deben configurarse juntos.');
  }
  const cloudflare = cloudflareZoneId && cloudflareToken ? await purgeCloudflare(cloudflareZoneId, cloudflareToken, keys) : { skipped: true };
  console.log(JSON.stringify({ ok: true, keys, varnish, cloudflare }));
}

function keysForScope(selectedScope, selectedSlug) {
  if (!selectedScope) return [];
  if (!['catalog', 'product', 'brand', 'category'].includes(selectedScope)) {
    throw new Error('--scope debe ser catalog, product, brand o category.');
  }
  if (selectedScope === 'catalog' || selectedScope === 'category') return ['catalog'];
  if (!selectedSlug) throw new Error(`--slug es obligatorio para --scope ${selectedScope}.`);
  if (selectedScope === 'brand') return ['catalog'];
  return [`product:${selectedSlug}`];
}

function normalizeKeys(values) {
  const keys = [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort();
  const invalid = keys.find((key) => !KEY_PATTERN.test(key));
  if (invalid) throw new Error(`XKey inválida: ${invalid}`);
  return keys.includes('catalog') ? ['catalog'] : keys;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en el entorno del API.`);
  return value;
}

function optionalEnv(name) {
  return process.env[name]?.trim() || undefined;
}

async function purgeVarnish(url, token, purgeKeys) {
  const response = await fetch(url, {
    method: 'PURGE',
    headers: {
      'X-Patitas-XKey': purgeKeys.join(' '),
      'X-Purge-Token': token,
    },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Varnish rechazó el purge (${response.status}).`);
  return { success: true };
}

async function purgeCloudflare(zoneId, token, purgeKeys) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags: purgeKeys }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) throw new Error(`Cloudflare rechazó el purge (${response.status}).`);
  return { success: true };
}
