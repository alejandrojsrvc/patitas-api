import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  extractAttribute,
  extractJsonLd,
  extractMeta,
  extractSectionText,
  extractTables,
  flattenJsonLd,
  htmlToText,
  normalizeText,
} from './html';
import {
  normalizeAttribute,
  normalizeMoney,
  normalizeWeightGrams,
  parseCompositionRows,
  parseFeedingTables,
} from './normalizers';
import type {
  CanonicalProductExtraction,
  CatalogResearchProductInput,
  FieldProvenance,
  RetailPriceObservation,
  RetailerCode,
} from './types';

const requireOptional = createRequire(__filename);

export interface FetchedPage {
  url: string;
  html: string;
  fetchedAt: string;
  contentHash: string;
  method: FieldProvenance['method'];
}

export const fetchPage = async (
  url: string,
  userAgent: string,
): Promise<FetchedPage> => {
  const response = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      accept:
        'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} al leer ${url}.`);
  const staticHtml = await response.text();
  const browserPage =
    process.env['CATALOG_RESEARCH_USE_BROWSER'] === '1'
      ? await tryRenderWithPlaywright(url, userAgent)
      : null;
  const html = browserPage ?? staticHtml;
  return {
    url,
    html,
    fetchedAt: new Date().toISOString(),
    contentHash: createHash('sha256').update(html).digest('hex'),
    method: browserPage ? 'BROWSER' : 'HTML',
  };
};

const tryRenderWithPlaywright = async (
  url: string,
  userAgent: string,
): Promise<string | null> => {
  try {
    const module = requireOptional('playwright') as {
      chromium?: {
        launch: (options: { headless: boolean }) => Promise<{
          newPage: (options: { userAgent: string }) => Promise<{
            goto: (
              target: string,
              options: { waitUntil: string },
            ) => Promise<unknown>;
            content: () => Promise<string>;
          }>;
          close: () => Promise<void>;
        }>;
      };
    };
    if (!module.chromium) return null;
    const browser = await module.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ userAgent });
      await page.goto(url, { waitUntil: 'networkidle' });
      return await page.content();
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
};

export const extractManufacturer = (
  page: FetchedPage,
): {
  product: CanonicalProductExtraction;
  provenance: Record<string, FieldProvenance>;
  warnings: string[];
} => {
  const tables = extractTables(page.html);
  const text = htmlToText(page.html);
  const tableRows = tables.flat();
  const compositionRows = tableRows.filter((row) =>
    /%|energía|em\b/i.test(row),
  );
  const ingredientSection = extractSectionText(page.html, 'Ingredientes');
  const presentationSection =
    extractSectionText(page.html, 'Presentaciones') ??
    extractSectionText(page.html, 'Tamaños disponibles') ??
    extractSectionText(page.html, 'Tamaños');
  const title = normalizeText(
    page.html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1],
  );
  const productJson = flattenJsonLd(extractJsonLd(page.html)).find((item) =>
    isProductType(item['@type']),
  );
  const primaryImage = [
    extractRoyalCaninMainImage(page.html),
    extractWooCommerceGalleryImage(page.html),
    extractMeta(page.html, 'og:image'),
    imageFromJsonLd(productJson?.['image']),
    extractAttribute(page.html, 'img', 'src')[0],
    extractAttribute(page.html, 'img', 'data-src')[0],
  ]
    .map((value) => (value ? toAbsoluteUrl(page.url, value) : null))
    .find((value): value is string => Boolean(value));
  const presentations = [
    ...(presentationSection ?? '').matchAll(
      /\b(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gr)\b/gi,
    ),
  ]
    .map((match) => normalizeWeightGrams(`${match[1]} ${match[2]}`))
    .filter((value): value is number => value !== null)
    .filter((value, index, values) => values.indexOf(value) === index);
  const product: CanonicalProductExtraction = {
    name: title,
    description: extractDescription(page.html),
    ingredientsText: ingredientSection,
    analyticalComposition: parseCompositionRows(compositionRows),
    presentations,
    feedingGuide: parseFeedingTables(tables),
    images: primaryImage
      ? [
          {
            sourceUrl: primaryImage,
            altText: title ?? 'Imagen del producto',
            isPrimary: true,
          },
        ]
      : [],
    attributes: {
      brand: title?.match(/old prince/i)?.[0] ?? null,
      species: /gato|cat/i.test(text)
        ? 'CAT'
        : /perro|dog/i.test(text)
          ? 'DOG'
          : null,
      line:
        title?.match(/premium|equilibrium|prote[ií]nas noveles/i)?.[0] ?? null,
      lifeStage:
        title?.match(/adult|cachorro|kitten|senior|puppy/i)?.[0] ?? null,
      breedSize: null,
      recipe: null,
    },
  };
  const provenance: Record<string, FieldProvenance> = {
    name: {
      sourceUrl: page.url,
      method: 'HTML',
      confidence: title ? 'HIGH' : 'LOW',
    },
    ingredientsText: {
      sourceUrl: page.url,
      method: 'HTML',
      confidence: ingredientSection ? 'HIGH' : 'LOW',
    },
    analyticalComposition: {
      sourceUrl: page.url,
      method: 'HTML',
      confidence: product.analyticalComposition.length ? 'HIGH' : 'LOW',
    },
    feedingGuide: {
      sourceUrl: page.url,
      method: 'HTML',
      confidence: product.feedingGuide.length ? 'HIGH' : 'LOW',
    },
    images: {
      sourceUrl: page.url,
      method: 'HTML',
      confidence: product.images.length ? 'MEDIUM' : 'LOW',
    },
  };
  const warnings: string[] = [];
  if (!product.ingredientsText)
    warnings.push('No se encontró una sección de ingredientes.');
  if (product.analyticalComposition.length === 0)
    warnings.push('No se encontró composición centesimal.');
  if (product.feedingGuide.length === 0)
    warnings.push('No se encontró tabla diaria.');
  return { product, provenance, warnings };
};

export const extractRetailObservation = (
  page: FetchedPage,
  retailer: RetailerCode,
  input: CatalogResearchProductInput,
): RetailPriceObservation => {
  const jsonLd = flattenJsonLd(extractJsonLd(page.html));
  const productJson = jsonLd.find((item) => item['@type'] === 'Product') ?? {};
  const offer = asRecord(productJson['offers']);
  const text = htmlToText(page.html);
  const title =
    normalizeText(asString(productJson['name'])) ?? extractTitle(page.html);
  const externalProductId =
    asString(productJson['sku']) ?? extractReference(text);
  const price =
    normalizeMoney(asString(offer['price'])) ?? firstVisiblePrice(text);
  const listPrice = extractListPrice(text, price);
  const weightGrams = extractExpectedWeight(title, input.expected.weightsGrams);
  const warnings: string[] = [];
  if (!price) warnings.push('No se pudo determinar un precio público.');
  if (!weightGrams)
    warnings.push('No se pudo determinar el peso de la variante.');
  const matchStatus = matchRetailProduct(title, weightGrams, input);
  if (matchStatus !== 'MATCHED')
    warnings.push(`La coincidencia quedó ${matchStatus}.`);
  return {
    retailer,
    sourceUrl: page.url,
    externalProductId,
    externalVariantId: extractVariantId(page.url, text),
    title,
    weightGrams,
    bonusWeightGrams: extractBonusWeight(text),
    price,
    listPrice,
    currency: 'ARS',
    availability: /sin stock|agotado|no disponible/i.test(text)
      ? 'OUT_OF_STOCK'
      : price
        ? 'AVAILABLE'
        : 'UNKNOWN',
    priceCondition:
      retailer === 'puppis' && /env[ií]o programado/i.test(text)
        ? 'web_public_no_programado'
        : null,
    matchStatus,
    warnings,
    observedAt: page.fetchedAt,
    extractionMethod: offer['price'] ? 'JSON_LD' : 'HTML',
  };
};

const extractDescription = (html: string): string | null =>
  extractMeta(html, 'description') ?? extractSectionText(html, 'Descripción');

const extractTitle = (html: string): string | null =>
  normalizeText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ??
  extractMeta(html, 'og:title');

const extractReference = (text: string): string | null =>
  text.match(/(?:referencia|sku|c[oó]digo)\s*:?\s*([A-Z0-9-]+)/i)?.[1] ?? null;

const isProductType = (value: unknown): boolean =>
  value === 'Product' || (Array.isArray(value) && value.includes('Product'));

const imageFromJsonLd = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string');
    return typeof first === 'string' ? first : null;
  }
  return null;
};

const extractWooCommerceGalleryImage = (html: string): string | null => {
  const galleryTag = html.match(
    /<[^>]*class=["'][^"']*woocommerce-product-gallery__image[^"']*["'][^>]*>/i,
  );
  if (!galleryTag || galleryTag.index === undefined) return null;
  const galleryHtml = html.slice(galleryTag.index, galleryTag.index + 5000);
  return (
    galleryHtml.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1] ??
    galleryHtml.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1] ??
    galleryHtml.match(/<img\b[^>]*data-src=["']([^"']+)["']/i)?.[1] ??
    null
  );
};

const extractRoyalCaninMainImage = (html: string): string | null => {
  const mainTag = html.match(
    /<[^>]*data-qa=["']product-images-main["'][^>]*>/i,
  );
  if (!mainTag || mainTag.index === undefined) return null;
  const mainHtml = html.slice(mainTag.index, mainTag.index + 8000);
  return (
    mainHtml.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1] ??
    mainHtml.match(/<img\b[^>]*data-src=["']([^"']+)["']/i)?.[1] ??
    mainHtml
      .match(/<img\b[^>]*srcset=["']([^"']+)["']/i)?.[1]
      ?.split(',')[0]
      ?.trim() ??
    null
  );
};

const toAbsoluteUrl = (baseUrl: string, value: string): string => {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

const firstVisiblePrice = (text: string): number | null => {
  for (const match of text.matchAll(/\$\s*([\d.]+(?:,\d{2})?)/g)) {
    const price = normalizeMoney(match[1]);
    if (price && price > 100) return price;
  }
  return null;
};

const extractListPrice = (
  text: string,
  currentPrice: number | null,
): number | null => {
  const values = [...text.matchAll(/\$\s*([\d.]+(?:,\d{2})?)/g)]
    .map((match) => normalizeMoney(match[1]))
    .filter((value): value is number => value !== null && value > 100);
  return (
    values.find(
      (value) => value !== currentPrice && value > (currentPrice ?? 0),
    ) ?? null
  );
};

const extractExpectedWeight = (
  title: string | null,
  expected: number[] | undefined,
): number | null => {
  const fromTitle = normalizeWeightGrams(title);
  if (fromTitle) return fromTitle;
  return expected?.length === 1 ? expected[0] : null;
};

const extractBonusWeight = (text: string): number | null => {
  const match = text.match(
    /\+\s*(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gr)\s*(?:gratis|de regalo)/i,
  );
  return match ? normalizeWeightGrams(`${match[1]} ${match[2]}`) : null;
};

const extractVariantId = (url: string, text: string): string | null =>
  new URL(url).searchParams.get('variacion') ??
  text.match(/variant(?:Id)?["'=: ]+(\d+)/i)?.[1] ??
  null;

const matchRetailProduct = (
  title: string | null,
  weightGrams: number | null,
  input: CatalogResearchProductInput,
): RetailPriceObservation['matchStatus'] => {
  if (!title) return 'AMBIGUOUS';
  const normalizedTitle = normalizeAttribute(title) ?? '';
  const expectedBrand = normalizeAttribute(input.expected.brand);
  if (expectedBrand && !normalizedTitle.includes(expectedBrand))
    return 'MISMATCH';
  if (
    input.expected.weightsGrams?.length &&
    weightGrams &&
    !input.expected.weightsGrams.includes(weightGrams)
  )
    return 'MISMATCH';
  if (!weightGrams && input.expected.weightsGrams?.length !== 1)
    return 'AMBIGUOUS';
  return 'MATCHED';
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string | null =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : null;
