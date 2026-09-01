import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient */
/** @typedef {{ path: string, contentType?: string }} StorageObject */
/** @typedef {{ accountId?: string, accessKeyId?: string, secretAccessKey?: string }} R2Credentials */

loadEnv({ path: ['.env.local', '.env.dist'], quiet: true });

const bucketArgument = process.argv.find((value) =>
  value.startsWith('--bucket='),
);
if (!bucketArgument) {
  throw new Error('Usa --bucket=product-media o --bucket=payment-proofs.');
}

const bucket = bucketArgument.slice('--bucket='.length);
if (!['product-media', 'payment-proofs'].includes(bucket)) {
  throw new Error(`El bucket ${bucket} no está permitido.`);
}

const apply = process.argv.includes('--apply');
const overwrite = process.argv.includes('--overwrite');
const credentialsArgument = process.argv.find((value) =>
  value.startsWith('--r2-credentials='),
);
const publicBaseUrlArgument = process.argv.find((value) =>
  value.startsWith('--public-base-url='),
);
const sourceUrl = process.env.PRODUCTION_SUPABASE_URL;
const sourceKey = process.env.PRODUCTION_SUPABASE_SECRET_KEY;

if (!sourceUrl || !sourceKey) {
  throw new Error(
    'PRODUCTION_SUPABASE_URL y PRODUCTION_SUPABASE_SECRET_KEY son obligatorias.',
  );
}

/** @type {SupabaseClient} */
const source = createClient(sourceUrl, sourceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const objects = await listObjects(source, bucket);
if (!apply) {
  let totalBytes = 0;
  for (const object of objects) {
    const data = await downloadObject(source, bucket, object.path);
    totalBytes += data.size;
  }
  console.log(
    JSON.stringify(
      { mode: 'source-verified', bucket, objects: objects.length, totalBytes },
      null,
      2,
    ),
  );
} else {
  await migrateToR2();
}

async function migrateToR2() {
  const credentials = credentialsArgument
    ? await readR2Credentials(
        resolve(credentialsArgument.slice('--r2-credentials='.length)),
      )
    : {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      };
  const { accountId, accessKeyId, secretAccessKey } = credentials;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Indica --r2-credentials=/ruta/credenciales.json o configura las variables R2.',
    );
  }

  const target = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  let copied = 0;
  let totalBytes = 0;
  for (const object of objects) {
    const data = await downloadObject(source, bucket, object.path);
    const bytes = new Uint8Array(await data.arrayBuffer());
    await target.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: object.path,
        Body: bytes,
        ContentType: data.type || object.contentType || undefined,
        CacheControl:
          bucket === 'product-media'
            ? 'public, max-age=31536000, immutable'
            : 'private, no-store',
        IfNoneMatch: overwrite ? undefined : '*',
      }),
    );

    const uploaded = await target.send(
      new HeadObjectCommand({ Bucket: bucket, Key: object.path }),
    );
    if (uploaded.ContentLength !== bytes.byteLength) {
      throw new Error(
        `El tamaño verificado de ${object.path} no coincide: ${uploaded.ContentLength} != ${bytes.byteLength}.`,
      );
    }

    copied += 1;
    totalBytes += bytes.byteLength;
    console.log(`[${copied}/${objects.length}] ${object.path}`);
  }

  console.log(
    JSON.stringify(
      { mode: 'apply-verified', bucket, copied, totalBytes },
      null,
      2,
    ),
  );

  if (credentialsArgument) {
    const publicBaseUrl =
      publicBaseUrlArgument?.slice('--public-base-url='.length) ??
      'https://media.patitasinquietas.com.ar';
    await configureLocalApi({
      accountId,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl,
    });
    console.log('API local configurada para Cloudflare R2 en .env.local.');
  }
}

/** @param {string} path @returns {Promise<R2Credentials>} */
async function readR2Credentials(path) {
  const content = await readFile(path, 'utf8');
  try {
    const parsed = JSON.parse(content);
    if (!isRecord(parsed))
      throw new Error('El JSON de credenciales no es un objeto.');
    return parseR2JsonCredentials(parsed);
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return parseR2TextCredentials(content);
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {Record<string, unknown>} parsed @returns {R2Credentials} */
function parseR2JsonCredentials(parsed) {
  const credentials = isRecord(parsed.credentials) ? parsed.credentials : {};
  const values = { ...parsed, ...credentials };
  const endpoint =
    values.endpoint ?? values.Endpoint ?? values.R2_ENDPOINT ?? undefined;
  const accountIdFromEndpoint =
    typeof endpoint === 'string'
      ? endpoint.match(
          /https:\/\/([a-f0-9]{32})\.r2\.cloudflarestorage\.com/i,
        )?.[1]
      : undefined;
  return {
    accountId:
      values.accountId ??
      values.account_id ??
      values.R2_ACCOUNT_ID ??
      accountIdFromEndpoint,
    accessKeyId:
      values.accessKeyId ??
      values.access_key_id ??
      values.AccessKeyId ??
      values.R2_ACCESS_KEY_ID,
    secretAccessKey:
      values.secretAccessKey ??
      values.secret_access_key ??
      values.SecretAccessKey ??
      values.R2_SECRET_ACCESS_KEY,
  };
}

/** @param {string} content @returns {R2Credentials} */
function parseR2TextCredentials(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  /** @param {string} label @returns {string | undefined} */
  const valueAfter = (label) => {
    const index = lines.findIndex((line) =>
      line.toLocaleLowerCase('es').includes(label),
    );
    return index >= 0 ? lines[index + 1] : undefined;
  };
  const endpoint = valueAfter('punto de conexión de la api de s3');
  return {
    accountId: endpoint?.match(
      /https:\/\/([a-f0-9]{32})\.r2\.cloudflarestorage\.com/i,
    )?.[1],
    accessKeyId: valueAfter('id de clave de acceso'),
    secretAccessKey: valueAfter('clave de acceso secreta'),
  };
}

/**
 * @param {{ accountId: string, accessKeyId: string, secretAccessKey: string, publicBaseUrl: string }} options
 */
async function configureLocalApi({
  accountId,
  accessKeyId,
  secretAccessKey,
  publicBaseUrl,
}) {
  const envPath = resolve('.env.local');
  const current = await readFile(envPath, 'utf8');
  const values = {
    R2_ACCOUNT_ID: accountId,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_PUBLIC_BASE_URL: publicBaseUrl,
  };
  const replaced = new Set();
  const lines = current.split(/\r?\n/).map((line) => {
    const key = Object.keys(values).find((name) => line.startsWith(`${name}=`));
    if (!key) return line;
    replaced.add(key);
    return `${key}=${values[key]}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!replaced.has(key)) lines.push(`${key}=${value}`);
  }
  await writeFile(envPath, `${lines.join('\n').replace(/\n+$/, '')}\n`, {
    mode: 0o600,
  });
}

/** @param {SupabaseClient} client @param {string} bucketName @param {string} [prefix] @returns {Promise<StorageObject[]>} */
async function listObjects(client, bucketName, prefix = '') {
  const objects = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.from(bucketName).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      throw new Error(
        `No se pudo listar ${bucketName}/${prefix}: ${error.message}`,
      );
    }

    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) {
        objects.push({
          path,
          contentType:
            typeof item.metadata?.mimetype === 'string'
              ? item.metadata.mimetype
              : undefined,
        });
      } else {
        objects.push(...(await listObjects(client, bucketName, path)));
      }
    }

    if (!data || data.length < 100) break;
  }
  return objects;
}

/** @param {SupabaseClient} client @param {string} bucketName @param {string} path @returns {Promise<Blob>} */
async function downloadObject(client, bucketName, path) {
  const { data, error } = await client.storage.from(bucketName).download(path);
  if (error || !data) {
    throw new Error(
      `No se pudo descargar ${bucketName}/${path}: ${error?.message}`,
    );
  }
  return data;
}
