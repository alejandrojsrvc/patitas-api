import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env.dist'], quiet: true });

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const PRODUCT_MEDIA_BUCKET = 'product-media';
/** @typedef {{ id: string, product_id: string, url: string, variant_id: string | null }} ProductMediaRow */
const rootArgument = process.argv.find((value) => value.startsWith('--dir='));
const imageDirectory = resolve(
  rootArgument?.slice('--dir='.length) ?? 'exports/product-images',
);
const apply = process.argv.includes('--apply');
const publish = process.argv.includes('--publish');

const supabaseUrl = process.env.PRODUCTION_SUPABASE_URL;
const secretKey = process.env.PRODUCTION_SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error(
    'Se requieren PRODUCTION_SUPABASE_URL y PRODUCTION_SUPABASE_SECRET_KEY para consultar producción.',
  );
}

if (publish && !apply) {
  throw new Error('Usa --publish junto con --apply.');
}

const files = (await readdir(imageDirectory, { withFileTypes: true }))
  .filter(
    (entry) =>
      entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()),
  )
  .map((entry) => ({
    fileName: entry.name,
    path: join(imageDirectory, entry.name),
    sku: entry.name.slice(0, -extname(entry.name).length),
    extension: extname(entry.name).slice(1).toLowerCase(),
  }))
  .sort((left, right) => left.sku.localeCompare(right.sku));

if (files.length === 0)
  throw new Error(`No hay imágenes válidas en ${imageDirectory}.`);

const client = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const skus = files.map(({ sku }) => sku);
const { data: variants, error: variantsError } = await client
  .from('product_variants')
  .select('id, sku, product_id, sale_price, active')
  .in('sku', skus);
if (variantsError)
  throw new Error(
    `No se pudieron consultar las variantes: ${variantsError.message}`,
  );

const productIds = [
  ...new Set((variants ?? []).map((variant) => variant.product_id)),
];
const { data: products, error: productsError } = await client
  .from('products')
  .select('id, name, status, brand_id, category_id')
  .in('id', productIds);
if (productsError)
  throw new Error(
    `No se pudieron consultar los productos: ${productsError.message}`,
  );

const brandIds = [
  ...new Set((products ?? []).map((product) => product.brand_id)),
];
const categoryIds = [
  ...new Set(
    (products ?? []).map((product) => product.category_id).filter(Boolean),
  ),
];
const [
  { data: brands, error: brandsError },
  { data: categories, error: categoriesError },
] = await Promise.all([
  client.from('brands').select('id, active').in('id', brandIds),
  client.from('categories').select('id, active').in('id', categoryIds),
]);
if (brandsError)
  throw new Error(
    `No se pudieron consultar las marcas: ${brandsError.message}`,
  );
if (categoriesError)
  throw new Error(
    `No se pudieron consultar las categorías: ${categoriesError.message}`,
  );

const { data: media, error: mediaError } = await client
  .from('product_media')
  .select('id, product_id, url, variant_id')
  .in(
    'product_id',
    productIds.length ? productIds : ['00000000-0000-0000-0000-000000000000'],
  );
if (mediaError)
  throw new Error(`No se pudo consultar la multimedia: ${mediaError.message}`);

const variantBySku = new Map(
  (variants ?? []).map((variant) => [variant.sku, variant]),
);
const productById = new Map(
  (products ?? []).map((product) => [product.id, product]),
);
const brandById = new Map((brands ?? []).map((brand) => [brand.id, brand]));
const categoryById = new Map(
  (categories ?? []).map((category) => [category.id, category]),
);
/** @type {Map<string, ProductMediaRow[]>} */
const mediaByProduct = new Map();
for (const item of /** @type {ProductMediaRow[]} */ (media ?? [])) {
  const current = mediaByProduct.get(item.product_id) ?? [];
  mediaByProduct.set(item.product_id, [...current, item]);
}

const missing = files.filter(({ sku }) => !variantBySku.has(sku));
const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index);
if (missing.length || duplicateSkus.length) {
  console.log(
    JSON.stringify(
      { missingSkus: missing.map(({ sku }) => sku), duplicateSkus },
      null,
      2,
    ),
  );
}

const results = [];
for (const file of files) {
  const variant = variantBySku.get(file.sku);
  if (!variant) {
    results.push({
      sku: file.sku,
      action: 'skipped',
      reason: 'variant-not-found',
    });
    continue;
  }

  const product = productById.get(variant.product_id);
  const existingMedia = mediaByProduct.get(variant.product_id) ?? [];
  const brand = product ? brandById.get(product.brand_id) : null;
  const category = product?.category_id
    ? categoryById.get(product.category_id)
    : null;
  const publishable = Boolean(
    product?.category_id &&
    category?.active &&
    brand?.active &&
    variant.active &&
    variant.sku &&
    Number(variant.sale_price) > 0 &&
    (existingMedia.length > 0 || apply),
  );

  if (!product) {
    results.push({
      sku: file.sku,
      action: 'skipped',
      reason: 'product-not-found',
    });
    continue;
  }

  if (existingMedia.length > 0) {
    if (publish && publishable && product.status !== 'ACTIVE') {
      const { error } = await client
        .from('products')
        .update({ status: 'ACTIVE' })
        .eq('id', product.id);
      if (error)
        throw new Error(`No se pudo activar ${file.sku}: ${error.message}`);
      results.push({
        sku: file.sku,
        productId: product.id,
        action: 'published-existing-media',
      });
    } else {
      results.push({
        sku: file.sku,
        productId: product.id,
        action: 'skipped-existing-media',
        status: product.status,
      });
    }
    continue;
  }

  const storagePath = `products/${product.id}/${file.sku}.${file.extension}`;
  results.push({
    sku: file.sku,
    productId: product.id,
    productName: product.name,
    action: apply ? 'upload-and-associate' : 'would-upload-and-associate',
    storagePath,
    publish: publish && publishable,
  });

  if (!apply) continue;

  const data = await readFile(file.path);
  const contentType =
    file.extension === 'jpg' || file.extension === 'jpeg'
      ? 'image/jpeg'
      : `image/${file.extension}`;
  const { error: uploadError } = await client.storage
    .from(PRODUCT_MEDIA_BUCKET)
    .upload(storagePath, data, { contentType, upsert: true });
  if (uploadError)
    throw new Error(`No se pudo subir ${file.sku}: ${uploadError.message}`);

  const { data: insertedMedia, error: mediaInsertError } = await client
    .from('product_media')
    .insert({
      product_id: product.id,
      variant_id: null,
      url: storagePath,
      alt_text: `Imagen de ${product.name}`,
      display_order: 0,
    })
    .select('id, product_id, url')
    .single();
  if (mediaInsertError) {
    await client.storage.from(PRODUCT_MEDIA_BUCKET).remove([storagePath]);
    throw new Error(
      `No se pudo asociar ${file.sku}: ${mediaInsertError.message}`,
    );
  }

  if (publish && publishable) {
    const { error: publishError } = await client
      .from('products')
      .update({ status: 'ACTIVE' })
      .eq('id', product.id);
    if (publishError)
      throw new Error(
        `Imagen ${insertedMedia.id} creada, pero no se pudo activar ${file.sku}: ${publishError.message}`,
      );
  }
}

console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'dry-run',
      directory: imageDirectory,
      bucket: PRODUCT_MEDIA_BUCKET,
      files: files.length,
      results,
    },
    null,
    2,
  ),
);
