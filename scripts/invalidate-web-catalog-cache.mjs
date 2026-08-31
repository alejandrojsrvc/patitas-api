import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env.dist'], quiet: true });

const args = process.argv.slice(2);
const valueFor = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const baseUrl = valueFor('--url') ?? process.env.PUBLIC_WEB_URL;
const token = process.env.CATALOG_CACHE_INVALIDATION_SECRET;
const scope = valueFor('--scope') ?? 'catalog';
const slug = valueFor('--slug');

if (!baseUrl) {
  throw new Error(
    'Falta --url o PUBLIC_WEB_URL. Ejemplo: --url http://localhost:3000',
  );
}
if (!token) {
  throw new Error(
    'Falta CATALOG_CACHE_INVALIDATION_SECRET en el entorno del API.',
  );
}

const endpoint = new URL('/api/internal/cache/catalog', baseUrl);
const payload = { scope, ...(slug ? { slug } : {}) };
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-catalog-cache-token': token,
  },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(10_000),
});

const body = await response.json().catch(() => null);
if (!response.ok) {
  throw new Error(
    `La invalidación falló (${response.status}). ${
      body && typeof body.message === 'string' ? body.message : 'Respuesta no válida.'
    }`,
  );
}

console.log(JSON.stringify(body ?? { ok: true }));
