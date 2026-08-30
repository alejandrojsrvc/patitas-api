import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env.dist'], quiet: true });

/**
 * @typedef {{
 *   path: string;
 *   kind: 'storage_path' | 'external_url';
 * }} ProductMediaObject
 */

/**
 * @typedef {{
 *   bucket: string;
 *   objects: ProductMediaObject[];
 * }} ProductMediaManifest
 */

const manifestArgument = process.argv.find((value) =>
  value.startsWith('--manifest='),
);
if (!manifestArgument)
  throw new Error('Usa --manifest=/ruta/product-media-manifest.json');

const apply = process.argv.includes('--apply');
const overwrite = process.argv.includes('--overwrite');
const sourceUrl = process.env.SUPABASE_URL;
const sourceKey = process.env.SUPABASE_SECRET_KEY;
const targetUrl = process.env.PRODUCTION_SUPABASE_URL;
const targetKey = process.env.PRODUCTION_SUPABASE_SECRET_KEY;

if (!sourceUrl || !sourceKey) {
  throw new Error(
    'SUPABASE_URL y SUPABASE_SECRET_KEY son obligatorias para el origen.',
  );
}
if (apply && (!targetUrl || !targetKey)) {
  throw new Error(
    'PRODUCTION_SUPABASE_URL y PRODUCTION_SUPABASE_SECRET_KEY son obligatorias con --apply.',
  );
}

const manifestPath = resolve(manifestArgument.slice('--manifest='.length));
/** @type {ProductMediaManifest} */
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const objects = manifest.objects.filter(({ kind }) => kind === 'storage_path');
const source = createClient(sourceUrl, sourceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

if (!apply) {
  let totalBytes = 0;
  for (const object of objects) {
    const { data, error } = await source.storage
      .from(manifest.bucket)
      .download(object.path);
    if (error || !data) {
      throw new Error(`No se pudo verificar ${object.path}: ${error?.message}`);
    }
    totalBytes += data.size;
  }
  console.log(
    JSON.stringify(
      {
        mode: 'source-verified',
        bucket: manifest.bucket,
        objects: objects.length,
        totalBytes,
        externalUrlsSkipped: manifest.objects.length - objects.length,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const target = createClient(targetUrl, targetKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let copied = 0;
for (const object of objects) {
  const { data, error: downloadError } = await source.storage
    .from(manifest.bucket)
    .download(object.path);
  if (downloadError || !data) {
    throw new Error(
      `No se pudo descargar ${object.path}: ${downloadError?.message}`,
    );
  }

  const { error: uploadError } = await target.storage
    .from(manifest.bucket)
    .upload(object.path, await data.arrayBuffer(), {
      contentType: data.type || undefined,
      upsert: overwrite,
    });
  if (uploadError) {
    throw new Error(`No se pudo subir ${object.path}: ${uploadError.message}`);
  }
  copied += 1;
  console.log(`[${copied}/${objects.length}] ${object.path}`);
}

console.log(
  JSON.stringify({ mode: 'apply', copied, bucket: manifest.bucket }, null, 2),
);
