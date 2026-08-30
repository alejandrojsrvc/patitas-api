import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

loadEnv({ path: ['.env.local', '.env.dist'], quiet: true });

/** @typedef {Record<string, unknown>} DatabaseRow */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL es obligatoria.');

const outputArgument = process.argv.find((value) =>
  value.startsWith('--output='),
);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDirectory = resolve(
  outputArgument?.slice('--output='.length) ??
    `exports/production-catalog-${timestamp}`,
);

const client = new pg.Client({ connectionString: databaseUrl });

/**
 * @param {string} sql
 * @returns {Promise<DatabaseRow[]>}
 */
const queryRows = async (sql) => (await client.query(sql)).rows;

/** @param {unknown} value */
const sqlValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'string') return sqlString(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date)
    return `${sqlString(value.toISOString())}::timestamptz`;
  if (typeof value === 'object') {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new Error('No se pudo serializar un valor JSON del catálogo.');
    }
    return `${sqlString(serialized)}::jsonb`;
  }
  throw new Error(`Tipo de valor SQL no soportado: ${typeof value}.`);
};

/** @param {string} value */
const sqlString = (value) => `'${value.replaceAll("'", "''")}'`;

/**
 * @param {string} table
 * @param {string[]} columns
 * @param {DatabaseRow[]} rows
 * @param {string[]} [updateColumns]
 */
const insertRows = (table, columns, rows, updateColumns = columns) => {
  if (rows.length === 0) return `-- ${table}: sin registros\n`;
  const values = rows
    .map(
      (row) =>
        `  (${columns.map((column) => sqlValue(row[column])).join(', ')})`,
    )
    .join(',\n');
  const updates = updateColumns
    .filter((column) => column !== 'id')
    .map((column) => `"${column}" = EXCLUDED."${column}"`)
    .join(',\n  ');
  return `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES\n${values}\nON CONFLICT ("id") DO UPDATE SET\n  ${updates};\n`;
};

await client.connect();

try {
  const products = await queryRows(`
    SELECT p.*
    FROM products p
    JOIN brands b ON b.id = p.brand_id
    WHERE p.name <> 'Test Product'
      AND b.name !~ '^Test [0-9a-f-]{36}$'
    ORDER BY p.created_at, p.id
  `);
  const productIds = products.map((product) => stringField(product, 'id'));
  if (productIds.length === 0)
    throw new Error('No hay productos reales para exportar.');

  const ids = productIds.map(sqlString).join(', ');
  const categories = await queryRows(`
    WITH RECURSIVE selected AS (
      SELECT c.*, 1 AS depth
      FROM categories c
      WHERE c.id IN (
        SELECT category_id FROM products
        WHERE id IN (${ids}) AND category_id IS NOT NULL
      )
      UNION ALL
      SELECT parent.*, selected.depth + 1
      FROM categories parent
      JOIN selected ON selected.parent_id = parent.id
    )
    SELECT DISTINCT ON (id) * FROM selected ORDER BY id, depth DESC
  `);
  categories.sort((left, right) => {
    if (left.parent_id === right.id) return 1;
    if (right.parent_id === left.id) return -1;
    return stringField(left, 'slug').localeCompare(stringField(right, 'slug'));
  });

  const brands = await queryRows(`
    SELECT * FROM brands WHERE id IN (
      SELECT DISTINCT brand_id FROM products WHERE id IN (${ids})
    ) ORDER BY name, id
  `);
  const variants = await queryRows(`
    SELECT * FROM product_variants WHERE product_id IN (${ids})
    ORDER BY product_id, weight_grams NULLS LAST, id
  `);
  const variantIds = variants.map((variant) => stringField(variant, 'id'));
  const variantSql = variantIds.map(sqlString).join(', ');
  const inventory = await queryRows(`
    SELECT * FROM inventory_items WHERE variant_id IN (${variantSql})
    ORDER BY variant_id
  `);
  const media = await queryRows(`
    SELECT * FROM product_media WHERE product_id IN (${ids})
    ORDER BY product_id, display_order, created_at, id
  `);
  const offers = await queryRows(`
    SELECT * FROM supplier_offers WHERE variant_id IN (${variantSql})
    ORDER BY supplier_id, variant_id, id
  `);
  const offerIds = offers.map((offer) => stringField(offer, 'id'));
  const suppliers = await queryRows(`
    SELECT * FROM suppliers WHERE id IN (
      SELECT DISTINCT supplier_id FROM supplier_offers
      WHERE variant_id IN (${variantSql})
    ) ORDER BY name, id
  `);

  const categoryColumns = [
    'id',
    'name',
    'slug',
    'description',
    'seo_title',
    'seo_description',
    'display_order',
    'parent_id',
    'active',
    'created_at',
    'updated_at',
  ];
  const brandColumns = [
    'id',
    'name',
    'slug',
    'description',
    'seo_title',
    'seo_description',
    'logo_url',
    'display_order',
    'active',
    'created_at',
    'updated_at',
  ];
  const productColumns = [
    'id',
    'name',
    'slug',
    'description',
    'ingredients_text',
    'analytical_composition',
    'brand_id',
    'category_id',
    'line',
    'species',
    'life_stage',
    'breed_size',
    'estimated_daily_grams_per_kg',
    'featured_rank',
    'status',
    'created_at',
    'updated_at',
  ];
  const variantColumns = [
    'id',
    'product_id',
    'sku',
    'barcode',
    'presentation',
    'weight_grams',
    'sale_price',
    'compare_at_price',
    'active',
    'preferred_supplier_offer_id',
    'revision',
    'created_at',
    'updated_at',
  ];
  const supplierColumns = ['id', 'name', 'active', 'created_at', 'updated_at'];
  const offerColumns = [
    'id',
    'supplier_id',
    'variant_id',
    'supplier_sku',
    'unit_cost',
    'currency',
    'stock_status',
    'lead_time_hours',
    'minimum_quantity',
    'active',
    'revision',
    'created_at',
    'updated_at',
  ];
  const inventoryColumns = [
    'id',
    'variant_id',
    'on_hand',
    'reserved',
    'updated_at',
  ];
  const mediaColumns = [
    'id',
    'product_id',
    'variant_id',
    'url',
    'alt_text',
    'display_order',
    'created_at',
  ];

  const preferredOffers = variants
    .filter((variant) => {
      const offerId = optionalStringField(
        variant,
        'preferred_supplier_offer_id',
      );
      return offerId !== null && offerIds.includes(offerId);
    })
    .map((variant) => {
      const offerId = stringField(variant, 'preferred_supplier_offer_id');
      const id = stringField(variant, 'id');
      return `UPDATE "product_variants" SET "preferred_supplier_offer_id" = ${sqlValue(offerId)} WHERE "id" = ${sqlValue(id)};`;
    });
  const variantsWithoutPreferred = variants.map((variant) => ({
    ...variant,
    preferred_supplier_offer_id: null,
  }));

  const sql = [
    '-- Exportación de catálogo Patitas para producción.',
    '-- Excluye Test Product y marcas Test <uuid>. Preserva UUIDs.',
    'BEGIN;',
    insertRows('categories', categoryColumns, categories),
    insertRows('brands', brandColumns, brands),
    insertRows('products', productColumns, products),
    insertRows('product_variants', variantColumns, variantsWithoutPreferred),
    insertRows('inventory_items', inventoryColumns, inventory),
    insertRows('product_media', mediaColumns, media),
    insertRows('suppliers', supplierColumns, suppliers),
    insertRows('supplier_offers', offerColumns, offers),
    preferredOffers.join('\n'),
    'COMMIT;',
    '',
  ].join('\n\n');

  const imageManifest = {
    bucket: 'product-media',
    generatedAt: new Date().toISOString(),
    objects: [
      ...media.map((item) => {
        const url = stringField(item, 'url');
        return {
          path: url,
          kind: /^https?:\/\//i.test(url) ? 'external_url' : 'storage_path',
          owner: 'product_media',
          productId: stringField(item, 'product_id'),
          variantId: optionalStringField(item, 'variant_id'),
        };
      }),
      ...brands
        .filter((brand) => optionalStringField(brand, 'logo_url') !== null)
        .map((brand) => {
          const logoUrl = stringField(brand, 'logo_url');
          return {
            path: logoUrl,
            kind: /^https?:\/\//i.test(logoUrl)
              ? 'external_url'
              : 'storage_path',
            owner: 'brand_logo',
            brandId: stringField(brand, 'id'),
          };
        }),
    ],
  };

  const report = {
    generatedAt: new Date().toISOString(),
    outputDirectory,
    excludedFilter:
      "products.name = 'Test Product' OR brands.name = 'Test <uuid>'",
    counts: {
      categories: categories.length,
      brands: brands.length,
      products: products.length,
      variants: variants.length,
      inventoryItems: inventory.length,
      productMedia: media.length,
      suppliers: suppliers.length,
      supplierOffers: offers.length,
      storageObjects: imageManifest.objects.filter(
        ({ kind }) => kind === 'storage_path',
      ).length,
      externalImages: imageManifest.objects.filter(
        ({ kind }) => kind === 'external_url',
      ).length,
    },
  };
  const instructions = `# Importación del catálogo en producción

Este paquete excluye los productos y marcas identificados inequívocamente como datos de prueba.

## 1. Preparación

- Aplicar primero todas las migraciones de Prisma en producción.
- Tomar un respaldo de la base productiva.
- Confirmar que el bucket privado \`product-media\` existe en Supabase Storage.
- Configurarlo con límite de 10 MB y MIME: \`image/jpeg\`, \`image/png\`, \`image/webp\`, \`image/gif\`.

## 2. Datos

El SQL es transaccional, conserva los UUID y restaura las ofertas preferidas después de crear las ofertas:

\`\`\`bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ${outputDirectory}/catalog-data.sql
\`\`\`

Antes de ejecutarlo, \`DATABASE_URL\` debe apuntar explícitamente a producción. No se incluyen usuarios, pedidos ni datos de clientes.

## 3. Imágenes

Las rutas almacenadas en \`product_media.url\` son relativas al bucket y el SQL no contiene los binarios.
Las credenciales se pasan por variables de entorno y no deben guardarse en el repositorio:

\`\`\`bash
export PRODUCTION_SUPABASE_URL="https://<proyecto>.supabase.co"
export PRODUCTION_SUPABASE_SECRET_KEY="<secret-key>"
pnpm catalog:copy-media -- --manifest=${outputDirectory}/product-media-manifest.json --apply
\`\`\`

El comando sin \`--apply\` verifica todos los objetos del origen y no escribe en producción. Usa \`--overwrite\` únicamente para reemplazar objetos que ya existan en el destino.
`;

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, 'catalog-data.sql'), sql, 'utf8'),
    writeFile(
      resolve(outputDirectory, 'product-media-manifest.json'),
      `${JSON.stringify(imageManifest, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      resolve(outputDirectory, 'export-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    ),
    writeFile(resolve(outputDirectory, 'README.md'), instructions, 'utf8'),
  ]);

  console.log(JSON.stringify(report, null, 2));
} finally {
  await client.end();
}

/**
 * @param {DatabaseRow} row
 * @param {string} field
 */
function stringField(row, field) {
  const value = row[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`El campo ${field} debe ser un string no vacío.`);
  }
  return value;
}

/**
 * @param {DatabaseRow} row
 * @param {string} field
 */
function optionalStringField(row, field) {
  const value = row[field];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`El campo ${field} debe ser un string o null.`);
  }
  return value;
}
