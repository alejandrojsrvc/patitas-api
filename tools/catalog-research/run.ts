import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  extractManufacturer,
  extractRetailObservation,
  fetchPage,
} from './adapters';
import { extractLinks } from './html';
import type {
  CatalogBrandResearchManifest,
  CatalogBrandResearchResult,
  CatalogResearchManifest,
  CatalogResearchProductResult,
  CatalogResearchRunResult,
  ExtractionStatus,
  RetailPriceObservation,
  RetailerCode,
} from './types';

const EXTRACTOR_VERSION = '1.0.0';
const DEFAULT_USER_AGENT =
  'PatitasCatalogResearch/1.0 (+https://patitas.com.ar/catalog-research)';

export const runResearch = async (
  manifestPath: string,
  outputPath: string,
): Promise<CatalogResearchRunResult> => {
  const manifest = JSON.parse(
    await readFile(resolve(manifestPath), 'utf8'),
  ) as CatalogResearchManifest;
  validateManifest(manifest);
  const startedAt = new Date().toISOString();
  const products: CatalogResearchProductResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const userAgent = manifest.userAgent ?? DEFAULT_USER_AGENT;

  for (const input of manifest.products) {
    try {
      const manufacturer = await fetchPage(input.manufacturerUrl, userAgent);
      const extracted = extractManufacturer(manufacturer);
      const retailObservations: RetailPriceObservation[] = [];
      for (const [retailer, url] of Object.entries(input.retailers)) {
        if (!url) continue;
        try {
          const page = await fetchPage(url, userAgent);
          retailObservations.push(
            extractRetailObservation(page, retailer as RetailerCode, input),
          );
        } catch (error) {
          retailObservations.push({
            retailer: retailer as RetailerCode,
            sourceUrl: url,
            externalProductId: null,
            externalVariantId: null,
            title: null,
            weightGrams: null,
            bonusWeightGrams: null,
            price: null,
            listPrice: null,
            currency: 'ARS',
            availability: 'UNKNOWN',
            priceCondition: null,
            matchStatus: 'BLOCKED',
            warnings: [errorMessage(error)],
            observedAt: new Date().toISOString(),
            extractionMethod: 'HTML' as const,
          });
        }
      }
      const status: ExtractionStatus = extracted.warnings.length
        ? 'PARTIAL'
        : 'SUCCESS';
      products.push({
        canonicalKey: input.canonicalKey,
        expected: input.expected,
        status,
        source: {
          url: manufacturer.url,
          fetchedAt: manufacturer.fetchedAt,
          contentHash: manufacturer.contentHash,
          status,
          warnings: extracted.warnings,
        },
        product: extracted.product,
        provenance: extracted.provenance,
        retailObservations,
        errors: [],
      });
    } catch (error) {
      const message = errorMessage(error);
      errors.push(`${input.canonicalKey}: ${message}`);
      products.push({
        canonicalKey: input.canonicalKey,
        expected: input.expected,
        status: 'ERROR' as const,
        source: {
          url: input.manufacturerUrl,
          fetchedAt: new Date().toISOString(),
          contentHash: '',
          status: 'ERROR' as const,
          warnings: [],
        },
        product: null,
        provenance: {},
        retailObservations: [],
        errors: [message],
      });
    }
  }

  const result: CatalogResearchRunResult = {
    schemaVersion: 'catalog-research.v1',
    runId: manifest.runId ?? randomUUID(),
    extractorVersion: EXTRACTOR_VERSION,
    startedAt,
    completedAt: new Date().toISOString(),
    products,
    warnings,
    errors,
  };
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(
    resolve(outputPath),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  return result;
};

export const runBrandResearch = async (
  manifestPath: string,
  outputPath: string,
): Promise<CatalogBrandResearchResult> => {
  const manifest = JSON.parse(
    await readFile(resolve(manifestPath), 'utf8'),
  ) as CatalogBrandResearchManifest;
  validateBrandManifest(manifest);
  const userAgent = manifest.userAgent ?? DEFAULT_USER_AGENT;
  const warnings: string[] = [];
  const errors: string[] = [];
  const productUrls = new Set<string>();

  for (const categoryUrl of manifest.categoryUrls) {
    try {
      const page = await fetchPage(categoryUrl, userAgent);
      for (const url of extractLinks(page.html, categoryUrl)) {
        if (
          isManufacturerProductUrl(
            url,
            categoryUrl,
            manifest.productPathContains,
          )
        )
          productUrls.add(url);
      }
    } catch (error) {
      warnings.push(`${categoryUrl}: ${errorMessage(error)}`);
    }
  }

  if (productUrls.size === 0)
    warnings.push('No se descubrieron fichas de producto.');

  const products: CatalogBrandResearchResult['products'] = [];
  for (const manufacturerUrl of productUrls) {
    try {
      const page = await fetchPage(manufacturerUrl, userAgent);
      const extracted = extractManufacturer(page);
      products.push({
        sourceUrl: manufacturerUrl,
        name: extracted.product.name,
        presentations: extracted.product.presentations,
        ingredients: extracted.product.ingredientsText,
        analyticalComposition: extracted.product.analyticalComposition,
        feedingGuide: extracted.product.feedingGuide.map((entry) => ({
          condition:
            entry.conditions['age'] ?? entry.conditions['activity'] ?? null,
          petWeightKgMin: entry.conditions['age'] ? null : entry.petWeightKgMin,
          petWeightKgMax: entry.conditions['age'] ? null : entry.petWeightKgMax,
          dailyGramsMin: entry.dailyGramsMin,
          dailyGramsMax: entry.dailyGramsMax,
        })),
        image: extracted.product.images[0]?.sourceUrl ?? null,
      });
      warnings.push(
        ...extracted.warnings.map(
          (warning) => `${manufacturerUrl}: ${warning}`,
        ),
      );
    } catch (error) {
      errors.push(`${manufacturerUrl}: ${errorMessage(error)}`);
    }
  }

  const result: CatalogBrandResearchResult = {
    schemaVersion: 'catalog-research.brand-result.v1',
    runId: randomUUID(),
    brand: manifest.brand,
    products,
    warnings,
    errors,
  };
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(
    resolve(outputPath),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  return result;
};

const validateManifest = (manifest: CatalogResearchManifest): void => {
  if (manifest.schemaVersion !== 'catalog-research.v1')
    throw new Error('schemaVersion no soportada.');
  if (!Array.isArray(manifest.products) || manifest.products.length === 0)
    throw new Error('El manifiesto no contiene productos.');
  for (const product of manifest.products) {
    if (
      !product.canonicalKey ||
      !product.manufacturerUrl ||
      !product.expected?.brand
    ) {
      throw new Error(
        'Cada producto requiere canonicalKey, manufacturerUrl y expected.brand.',
      );
    }
    new URL(product.manufacturerUrl);
    Object.values(product.retailers).forEach((url) => {
      if (url) new URL(url);
    });
  }
};

const validateBrandManifest = (
  manifest: CatalogBrandResearchManifest,
): void => {
  if (manifest.schemaVersion !== 'catalog-research.brand.v1')
    throw new Error('schemaVersion de marca no soportada.');
  if (!manifest.brand || !manifest.categoryUrls.length)
    throw new Error('El manifiesto de marca requiere brand y categoryUrls.');
  manifest.categoryUrls.forEach((url) => new URL(url));
};

const isManufacturerProductUrl = (
  url: string,
  categoryUrl: string,
  productPathContains?: string[],
): boolean => {
  const category = new URL(categoryUrl);
  const candidate = new URL(url);
  return (
    candidate.origin === category.origin &&
    candidate.pathname !== category.pathname &&
    (productPathContains?.some((pattern) =>
      candidate.pathname.includes(pattern),
    ) ??
      candidate.pathname.includes('/producto/'))
  );
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Error desconocido.';
