import { createClient } from '@supabase/supabase-js';

const BUCKET = 'product-media';

if (!process.argv.includes('--production')) {
  throw new Error(
    'Debes confirmar el destino con --production. Este script cambia la visibilidad del bucket comercial.',
  );
}

const url = process.env.PRODUCTION_SUPABASE_URL;
const secretKey = process.env.PRODUCTION_SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error(
    'Faltan PRODUCTION_SUPABASE_URL o PRODUCTION_SUPABASE_SECRET_KEY.',
  );
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: current, error: readError } =
  await supabase.storage.getBucket(BUCKET);
if (readError || !current) {
  throw new Error(`No se pudo leer el bucket ${BUCKET}.`, {
    cause: readError ?? undefined,
  });
}

if (current.public) {
  process.stdout.write(`${BUCKET} ya es público.\n`);
  process.exit(0);
}

const { error: updateError } = await supabase.storage.updateBucket(BUCKET, {
  public: true,
});
if (updateError) {
  throw new Error(`No se pudo publicar el bucket ${BUCKET}.`, {
    cause: updateError,
  });
}

process.stdout.write(`${BUCKET} quedó configurado como bucket público.\n`);
