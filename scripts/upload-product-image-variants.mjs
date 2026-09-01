import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { config as loadEnv } from 'dotenv';
import { readFile, readFile as readManifest } from 'node:fs/promises';
import { join, resolve } from 'node:path';

loadEnv({ path: ['.env.local', '.env.dist'], quiet: true });

const inputDirectory = resolve(
  argumentValue('--dir') ?? 'exports/product-images',
);
const manifestPath = join(inputDirectory, 'optimized', 'manifest.json');
const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');

if (!apply) {
  throw new Error(
    'La subida requiere confirmación explícita: usa --apply. El modo por defecto es solo lectura.',
  );
}

const accountId = requiredEnv('R2_ACCOUNT_ID');
const accessKeyId = requiredEnv('R2_ACCESS_KEY_ID');
const secretAccessKey = requiredEnv('R2_SECRET_ACCESS_KEY');
const bucket = 'product-media';
/** @type {{ entries: Array<{ sku: string, variants: Array<{ relativePath: string }> }> }} */
const manifest = JSON.parse(await readManifest(manifestPath, 'utf8'));
const variants = manifest.entries.flatMap((entry) =>
  entry.variants.map((variant) => ({
    sku: entry.sku,
    localPath: join(inputDirectory, variant.relativePath),
    objectPath: variant.relativePath,
  })),
);

if (!variants.length)
  throw new Error(`El manifiesto no contiene variantes: ${manifestPath}`);

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

let uploaded = 0;
let totalBytes = 0;
for (const variant of variants) {
  const data = await readFile(variant.localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: variant.objectPath,
      Body: data,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
      IfNoneMatch: force ? undefined : '*',
    }),
  );

  const remote = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: variant.objectPath }),
  );
  if (remote.ContentLength !== data.byteLength) {
    throw new Error(
      `El tamaño verificado de ${variant.objectPath} no coincide: ${remote.ContentLength} != ${data.byteLength}.`,
    );
  }

  uploaded += 1;
  totalBytes += data.byteLength;
  console.log(`[${uploaded}/${variants.length}] ${variant.objectPath}`);
}

console.log(
  JSON.stringify(
    {
      mode: force ? 'apply-overwrite' : 'apply-no-overwrite',
      bucket,
      manifest: manifestPath,
      uploaded,
      totalBytes,
      publicBaseUrl: 'https://media.patitasinquietas.com.ar',
    },
    null,
    2,
  ),
);

function argumentValue(name) {
  const argument = process.argv.find((value) => value.startsWith(`${name}=`));
  return argument?.slice(name.length + 1);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}
