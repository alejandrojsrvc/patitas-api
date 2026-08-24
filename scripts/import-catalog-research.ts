import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { assertLocalDatabaseUrl } from './database-safety';
import { loadProjectEnv } from './load-project-env';
import { PrismaClient } from '../src/infrastructure/database/generated/prisma/client';
import { SupabaseAdminClient } from '../src/infrastructure/storage/supabase/supabase-admin.client';
import { SupabaseStorageAdapter } from '../src/infrastructure/storage/supabase/supabase-storage.adapter';
import type { StorageProvider } from '../src/shared/application/ports/storage-provider.interface';
import type {
  CatalogBrandResearchResult,
  CatalogResearchRunResult,
  CatalogResearchProductResult,
} from '../tools/catalog-research/types';

loadProjectEnv();

const scriptArgs = process.argv
  .slice(2)
  .filter((argument) => argument !== '--');
const JSON_PATH = scriptArgs[0];
const APPROVAL_PATH = scriptArgs[1];
const DRY_RUN = scriptArgs.includes('--dry-run');
const PRODUCT_MEDIA_BUCKET = 'product-media';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface ApprovalFile {
  schemaVersion: 'catalog-research.approval.v1';
  runId: string;
  approvedProducts: string[];
}

const main = async (): Promise<void> => {
  if (!JSON_PATH) {
    throw new Error(
      'Uso: pnpm catalog:research:import -- <resultado.json> [aprobacion.json] [--dry-run].',
    );
  }
  const result = parseResult(readFileSync(resolve(JSON_PATH), 'utf8'));
  const approved = APPROVAL_PATH
    ? selectApprovedProducts(
        result,
        readFileSync(resolve(APPROVAL_PATH), 'utf8'),
      )
    : result.products;
  if (approved.length === 0)
    throw new Error('La aprobación no contiene productos del resultado.');

  console.log(
    `Resultado válido: ${approved.length} productos aprobados, ${countObservations(approved)} observaciones de retail.`,
  );
  if (DRY_RUN) return;

  const connectionString = process.env['DATABASE_URL'];
  assertLocalDatabaseUrl(connectionString, process.env);
  const storage = createStorageProvider();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString! }),
  });
  try {
    const imported = await prisma.$transaction(async (tx) => {
      const products: ImportedProduct[] = [];
      for (const product of approved) {
        products.push(await importProduct(tx, product, result));
      }
      return products;
    });
    for (const product of imported) {
      await importMedia(prisma, product.productId, product.image, storage);
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(
    `Importación aprobada completada para ${approved.length} productos en estado DRAFT.`,
  );
};

const importProduct = async (
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  result: CatalogResearchProductResult,
  run: CatalogResearchRunResult,
): Promise<ImportedProduct> => {
  if (!result.product)
    throw new Error(`${result.canonicalKey} no tiene ficha canónica.`);
  const category = await tx.category.findUnique({
    where: { slug: 'alimento-seco' },
  });
  if (!category) throw new Error('No existe la categoría alimento-seco.');
  const brandName = result.product.attributes.brand ?? result.expected.brand;
  const brand = await tx.brand.upsert({
    where: { slug: slugify(brandName) },
    update: { name: brandName, active: true },
    create: { name: brandName, slug: slugify(brandName), active: true },
  });
  const name = result.product.name ?? result.canonicalKey;
  const product = await tx.product.upsert({
    where: { slug: slugify(name) },
    update: {
      name,
      description: result.product.description,
      ingredientsText: result.product.ingredientsText,
      analyticalComposition: result.product.analyticalComposition as never,
      brandId: brand.id,
      categoryId: category.id,
      species: result.product.attributes.species ?? result.expected.species,
      line: result.product.attributes.line ?? result.expected.line ?? null,
      lifeStage:
        result.product.attributes.lifeStage ??
        result.expected.lifeStage ??
        null,
      breedSize:
        result.product.attributes.breedSize ??
        result.expected.breedSize ??
        null,
    },
    create: {
      name,
      slug: slugify(name),
      description: result.product.description,
      ingredientsText: result.product.ingredientsText,
      analyticalComposition: result.product.analyticalComposition as never,
      brandId: brand.id,
      categoryId: category.id,
      species: result.product.attributes.species ?? result.expected.species,
      line: result.product.attributes.line ?? result.expected.line ?? null,
      lifeStage:
        result.product.attributes.lifeStage ??
        result.expected.lifeStage ??
        null,
      breedSize:
        result.product.attributes.breedSize ??
        result.expected.breedSize ??
        null,
      status: 'DRAFT',
    },
  });
  const weights = uniqueNumbers([
    ...result.product.presentations,
    ...(result.expected.weightsGrams ?? []),
  ]);
  const variants = new Map<number, string>();
  for (const weightGrams of weights) {
    const variant = await tx.productVariant.upsert({
      where: { productId_weightGrams: { productId: product.id, weightGrams } },
      update: { presentation: `${weightGrams / 1000} kg`, active: true },
      create: {
        productId: product.id,
        presentation: `${weightGrams / 1000} kg`,
        weightGrams,
        active: true,
      },
    });
    variants.set(weightGrams, variant.id);
  }
  await tx.productSourceSnapshot.upsert({
    where: {
      productId_contentHash: {
        productId: product.id,
        contentHash: result.source.contentHash,
      },
    },
    update: {
      status: result.status,
      warnings: result.source.warnings as never,
      payload: result.product as never,
    },
    create: {
      productId: product.id,
      sourceType: 'MANUFACTURER',
      sourceUrl: result.source.url,
      fetchedAt: new Date(result.source.fetchedAt),
      contentHash: result.source.contentHash,
      extractorVersion: run.extractorVersion,
      status: result.status,
      warnings: result.source.warnings as never,
      payload: result.product as never,
    },
  });
  await importFeedingGuide(tx, product.id, result);
  for (const observation of result.retailObservations) {
    if (observation.matchStatus === 'BLOCKED' || !observation.weightGrams)
      continue;
    const variantId = variants.get(observation.weightGrams);
    if (!variantId) continue;
    await tx.retailPriceObservation.create({
      data: {
        variantId,
        retailerCode: observation.retailer,
        sourceUrl: observation.sourceUrl,
        externalProductId: observation.externalProductId,
        externalVariantId: observation.externalVariantId,
        titleSnapshot: observation.title,
        weightGrams: observation.weightGrams,
        bonusWeightGrams: observation.bonusWeightGrams,
        price: decimalOrNull(observation.price),
        listPrice: decimalOrNull(observation.listPrice),
        currency: observation.currency,
        availability: observation.availability,
        priceCondition: observation.priceCondition,
        matchStatus: observation.matchStatus,
        warnings: observation.warnings as never,
        runId: run.runId,
        observedAt: new Date(observation.observedAt),
      },
    });
  }
  return {
    productId: product.id,
    image: result.product.images[0] ?? null,
  };
};

const importMedia = async (
  prisma: PrismaClient,
  productId: string,
  image: NonNullable<CatalogResearchProductResult['product']>['images'][number] | null,
  storage: StorageProvider,
): Promise<void> => {
  if (!image) return;
  const downloaded = await downloadImage(image.sourceUrl);
  const extension = imageExtension(downloaded.contentType);
  const path = `products/${productId}/manufacturer-primary.${extension}`;
  await storage.upload({
    object: { bucket: PRODUCT_MEDIA_BUCKET, path },
    data: downloaded.data,
    contentType: downloaded.contentType,
    upsert: true,
  });
  const existing = await prisma.productMedia.findFirst({
    where: { productId, displayOrder: 0 },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    await prisma.productMedia.update({
      where: { id: existing.id },
      data: { url: path, altText: image.altText, displayOrder: 0 },
    });
    return;
  }
  await prisma.productMedia.create({
    data: {
      productId,
      url: path,
      altText: image.altText,
      displayOrder: 0,
    },
  });
};

interface ImportedProduct {
  productId: string;
  image: NonNullable<CatalogResearchProductResult['product']>['images'][number] | null;
}

const createStorageProvider = (): StorageProvider =>
  new SupabaseStorageAdapter(new SupabaseAdminClient(new ConfigService()));

const downloadImage = async (
  sourceUrl: string,
): Promise<{ data: Uint8Array; contentType: string }> => {
  const response = await fetch(sourceUrl, { redirect: 'follow' });
  if (!response.ok)
    throw new Error(`HTTP ${response.status} al descargar ${sourceUrl}.`);
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType))
    throw new Error(`Tipo de imagen no permitido en ${sourceUrl}.`);
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES)
    throw new Error(`Tamaño de imagen inválido en ${sourceUrl}.`);
  return { data, contentType };
};

const imageExtension = (contentType: string): string =>
  ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  })[contentType] ?? 'bin';

const importFeedingGuide = async (
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  productId: string,
  result: CatalogResearchProductResult,
): Promise<void> => {
  const entries = result.product?.feedingGuide ?? [];
  if (entries.length === 0) return;
  const latest = await tx.feedingGuide.findFirst({
    where: { productId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  await tx.feedingGuide.updateMany({
    where: { productId, active: true },
    data: { active: false },
  });
  await tx.feedingGuide.create({
    data: {
      productId,
      sourceLabel: 'Fabricante - extracción aprobada',
      sourceUrl: result.source.url,
      version: (latest?.version ?? 0) + 1,
      requiredDimensions: {},
      entries: {
        create: entries.map((entry) => ({
          petWeightKgMin: entry.petWeightKgMin,
          petWeightKgMax: entry.petWeightKgMax,
          lifeStage: entry.lifeStage,
          conditions: entry.conditions,
          dailyGramsMin: entry.dailyGramsMin,
          dailyGramsMax: entry.dailyGramsMax,
        })),
      },
    },
  });
};

const parseResult = (value: string): CatalogResearchRunResult => {
  const result = JSON.parse(value) as
    | CatalogResearchRunResult
    | CatalogBrandResearchResult;
  if (result.schemaVersion === 'catalog-research.brand-result.v1')
    return normalizeBrandResult(result);
  if (
    result.schemaVersion !== 'catalog-research.v1' ||
    !result.runId ||
    !Array.isArray(result.products)
  ) {
    throw new Error('El resultado no cumple catalog-research.v1.');
  }
  return result;
};

const normalizeBrandResult = (
  result: CatalogBrandResearchResult,
): CatalogResearchRunResult => ({
  schemaVersion: 'catalog-research.v1',
  runId: result.runId,
  extractorVersion: 'catalog-research.brand-result.v1',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  products: result.products.map((product) => {
    const species = inferSpecies(product.name);
    return {
      canonicalKey: slugify(product.name ?? product.sourceUrl),
      expected: {
        brand: result.brand,
        species,
        weightsGrams: product.presentations,
      },
      status: 'SUCCESS',
      source: {
        url: product.sourceUrl,
        fetchedAt: new Date().toISOString(),
        contentHash: createHash('sha256')
          .update(JSON.stringify(product))
          .digest('hex'),
        status: 'SUCCESS',
        warnings: [],
      },
      product: {
        name: product.name,
        description: null,
        ingredientsText: product.ingredients,
        analyticalComposition: product.analyticalComposition,
        presentations: product.presentations,
        feedingGuide: product.feedingGuide
          .filter((entry) => entry.petWeightKgMin !== null)
          .map((entry) => ({
            petWeightKgMin: entry.petWeightKgMin as number,
            petWeightKgMax: entry.petWeightKgMax,
            lifeStage: null,
            conditions: entry.condition
              ? { condition: entry.condition }
              : ({} as Record<string, string>),
            dailyGramsMin: entry.dailyGramsMin,
            dailyGramsMax: entry.dailyGramsMax,
            rawWeight: entry.condition ?? `${entry.petWeightKgMin} kg`,
            rawDailyAmount: `${entry.dailyGramsMin}${entry.dailyGramsMax ? ` - ${entry.dailyGramsMax}` : ''} g`,
          })),
        images: product.image
          ? [
              {
                sourceUrl: product.image,
                altText: product.name ?? 'Imagen del producto',
                isPrimary: true,
              },
            ]
          : [],
        attributes: {
          brand: result.brand,
          species,
          line: null,
          lifeStage: null,
          breedSize: null,
          recipe: null,
        },
      },
      provenance: {},
      retailObservations: [],
      errors: [],
    };
  }),
  warnings: result.warnings,
  errors: result.errors,
});

const inferSpecies = (name: string | null): 'DOG' | 'CAT' =>
  /gato|gatito|cat/i.test(name ?? '') ? 'CAT' : 'DOG';

const parseApproval = (value: string): ApprovalFile => {
  const approval = JSON.parse(value) as ApprovalFile;
  if (
    approval.schemaVersion !== 'catalog-research.approval.v1' ||
    !approval.runId ||
    !Array.isArray(approval.approvedProducts)
  ) {
    throw new Error('La aprobación no cumple catalog-research.approval.v1.');
  }
  return approval;
};

const selectApprovedProducts = (
  result: CatalogResearchRunResult,
  value: string,
): CatalogResearchProductResult[] => {
  const approval = parseApproval(value);
  if (approval.runId !== result.runId) {
    throw new Error('La aprobación no corresponde al runId del resultado.');
  }
  return result.products.filter(
    (product) =>
      approval.approvedProducts.includes(product.canonicalKey) ||
      approval.approvedProducts.includes(product.source.url),
  );
};

const countObservations = (products: CatalogResearchProductResult[]): number =>
  products.reduce(
    (total, product) => total + product.retailObservations.length,
    0,
  );

const uniqueNumbers = (values: number[]): number[] =>
  values.filter(
    (value, index) =>
      Number.isInteger(value) && value > 0 && values.indexOf(value) === index,
  );

const decimalOrNull = (value: number | null): string | null =>
  value === null ? null : value.toFixed(2);

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'No se pudo importar la investigación.',
  );
  process.exit(1);
});
