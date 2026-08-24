import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadProjectEnv } from './load-project-env';
import { assertLocalDatabaseUrl } from './database-safety';
import { PrismaClient } from '../src/infrastructure/database/generated/prisma/client';

loadProjectEnv();

const CSV_PATH = process.argv[2];
const DRY_RUN = process.argv.includes('--dry-run');
const REQUIRED_HEADERS = [
  'brand',
  'product_name',
  'slug',
  'species',
  'category',
  'life_stage',
  'description',
  'sku',
  'presentation_label',
  'weight_grams',
];

type CsvRow = Record<string, string>;

const parseCsv = (contents: string): CsvRow[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    const next = contents[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted)
    throw new Error('El CSV termina dentro de un campo entrecomillado.');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const headers =
    rows.shift()?.map((header) => header.replace(/^\uFEFF/, '').trim()) ?? [];
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `Faltan columnas obligatorias: ${missingHeaders.join(', ')}.`,
    );
  }

  return rows
    .filter((values) => values.some((value) => value.trim() !== ''))
    .map((values, rowIndex) => {
      if (values.length !== headers.length) {
        throw new Error(
          `La fila ${rowIndex + 2} tiene ${values.length} columnas; se esperaban ${headers.length}.`,
        );
      }
      return Object.fromEntries(
        headers.map((header, index) => [header, values[index].trim()]),
      );
    });
};

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const categorySlug = (value: string): string => {
  const categories: Record<string, string> = {
    DRY_FOOD: 'alimento-seco',
  };
  const slug = categories[value];
  if (!slug)
    throw new Error(`La categoría ${value} no tiene un mapeo persistente.`);
  return slug;
};

const requiredValue = (row: CsvRow, key: string, rowNumber: number): string => {
  const value = row[key]?.trim();
  if (!value) throw new Error(`La fila ${rowNumber} no tiene ${key}.`);
  return value;
};

const parseWeight = (row: CsvRow, rowNumber: number): number => {
  const value = Number(requiredValue(row, 'weight_grams', rowNumber));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `La fila ${rowNumber} tiene un peso inválido: ${row.weight_grams}.`,
    );
  }
  return value;
};

const validateRows = (rows: CsvRow[]): void => {
  const seenSkus = new Set<string>();
  const seenProductWeights = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    requiredValue(row, 'brand', rowNumber);
    requiredValue(row, 'product_name', rowNumber);
    requiredValue(row, 'slug', rowNumber);
    requiredValue(row, 'species', rowNumber);
    requiredValue(row, 'category', rowNumber);
    requiredValue(row, 'description', rowNumber);
    const sku = requiredValue(row, 'sku', rowNumber);
    const slug = requiredValue(row, 'slug', rowNumber);
    const weight = parseWeight(row, rowNumber);

    if (seenSkus.has(sku)) throw new Error(`El SKU ${sku} está repetido.`);
    seenSkus.add(sku);

    const productWeight = `${slug}:${weight}`;
    if (seenProductWeights.has(productWeight)) {
      throw new Error(`El producto ${slug} repite el peso ${weight} g.`);
    }
    seenProductWeights.add(productWeight);
  });
};

const main = async (): Promise<void> => {
  if (!CSV_PATH)
    throw new Error('Uso: pnpm catalog:import -- <archivo.csv> [--dry-run].');

  const rows = parseCsv(readFileSync(resolve(CSV_PATH), 'utf8'));
  validateRows(rows);

  const productSlugs = new Set(rows.map((row) => row.slug));
  console.log(
    `CSV válido: ${rows.length} variantes, ${productSlugs.size} productos.`,
  );
  if (DRY_RUN) return;

  const connectionString = process.env['DATABASE_URL'];
  assertLocalDatabaseUrl(connectionString, process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString! }),
  });

  try {
    await prisma.$transaction(async (tx) => {
      const products = new Map<string, string>();

      for (const row of rows) {
        const brand = await tx.brand.upsert({
          where: { slug: slugify(row.brand) },
          update: { name: row.brand, active: true },
          create: { name: row.brand, slug: slugify(row.brand), active: true },
        });
        const category = await tx.category.findUnique({
          where: { slug: categorySlug(row.category) },
        });
        if (!category)
          throw new Error(
            `No existe la categoría ${categorySlug(row.category)}.`,
          );

        let productId = products.get(row.slug);
        if (!productId) {
          const product = await tx.product.upsert({
            where: { slug: row.slug },
            update: {
              name: row.product_name,
              description: row.description,
              brandId: brand.id,
              categoryId: category.id,
              species: row.species.toLowerCase(),
              lifeStage: row.life_stage ? row.life_stage.toLowerCase() : null,
              breedSize: row.breed_size ? row.breed_size.toLowerCase() : null,
              status: 'ACTIVE',
            },
            create: {
              name: row.product_name,
              slug: row.slug,
              description: row.description,
              brandId: brand.id,
              categoryId: category.id,
              species: row.species.toLowerCase(),
              lifeStage: row.life_stage ? row.life_stage.toLowerCase() : null,
              breedSize: row.breed_size ? row.breed_size.toLowerCase() : null,
              status: 'ACTIVE',
            },
          });
          productId = product.id;
          products.set(row.slug, product.id);
        }

        const weightGrams = parseWeight(row, rows.indexOf(row) + 2);
        const bySku = await tx.productVariant.findUnique({
          where: { sku: row.sku },
        });
        if (bySku && bySku.productId !== productId) {
          throw new Error(`El SKU ${row.sku} ya pertenece a otro producto.`);
        }
        const byWeight = bySku
          ? null
          : await tx.productVariant.findUnique({
              where: { productId_weightGrams: { productId, weightGrams } },
            });
        const variant = bySku ?? byWeight;
        if (variant) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: row.sku,
              presentation: row.presentation_label || null,
              weightGrams,
              active: true,
            },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId,
              sku: row.sku,
              presentation: row.presentation_label || null,
              weightGrams,
              active: true,
            },
          });
        }
      }
    });

    console.log(
      `Importación completada: ${productSlugs.size} productos activos y ${rows.length} variantes activas.`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'No se pudo importar el catálogo.',
  );
  process.exit(1);
});
