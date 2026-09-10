import { CatalogNotFoundError } from '../domain/errors/catalog.error';
import {
  STATIC_CATALOG_LANDINGS,
  brandIndexLanding,
  brandLanding,
  brandedCatalogLanding,
  normalizeLegacyCatalogPath,
  validCatalogPath,
  type CatalogLanding,
  type CatalogPathResolution,
} from '../domain/catalog-taxonomy';
import type { CatalogRepository } from '../domain/repositories/catalog.repository';
import type { CatalogProductQuery } from '../domain/catalog.types';

export class CatalogTaxonomyService {
  public constructor(private readonly repository: CatalogRepository) {}

  public async resolveCatalogPath(path: string): Promise<CatalogPathResolution> {
    if (!validCatalogPath(path)) throw new CatalogNotFoundError('La página de catálogo');
    const landings = await this.listIndexableLandings();
    const direct = landings.find((landing) => landing.seo.canonical === path);
    if (direct) return direct;

    const normalized = normalizeLegacyCatalogPath(path);
    if (normalized !== path && landings.some((landing) => landing.seo.canonical === normalized)) {
      return { kind: 'REDIRECT', statusCode: 308, destination: normalized };
    }
    throw new CatalogNotFoundError('La página de catálogo');
  }

  public async buildCatalogPath(filters: Partial<CatalogProductQuery>): Promise<string> {
    const landing = (await this.listIndexableLandings()).find((candidate) => sameSeoFilters(candidate.filters, filters));
    if (!landing) throw new CatalogNotFoundError('La combinación SEO de catálogo');
    return landing.seo.canonical;
  }

  public async listIndexableLandings(): Promise<CatalogLanding[]> {
    const [brands, combinations] = await Promise.all([this.repository.listBrands(false), this.repository.listPublicBrandTaxonomyCombinations()]);
    const activeBrands = brands.filter((brand) => brand.active);
    const branded = combinations.flatMap((combination) => {
      const landing = brandedCatalogLanding(combination);
      return landing ? [landing] : [];
    });
    const unique = new Map<string, CatalogLanding>();
    for (const landing of [brandIndexLanding(), ...STATIC_CATALOG_LANDINGS, ...activeBrands.map(brandLanding), ...branded]) {
      unique.set(landing.seo.canonical, landing);
    }
    return [...unique.values()];
  }
}

const seoFilterKeys = ['species', 'category', 'foodType', 'lifeStage', 'categorySlug', 'brand'] as const;

const sameSeoFilters = (left: Partial<CatalogProductQuery>, right: Partial<CatalogProductQuery>) =>
  seoFilterKeys.every((key) => {
    const leftValues = toValues(left[key]);
    const rightValues = toValues(right[key]);
    return leftValues.length === rightValues.length && leftValues.every((value, index) => value === rightValues[index]);
  });

const toValues = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return values
    .map(toCatalogValue)
    .filter((item): item is string => item !== null)
    .sort();
};

const toCatalogValue = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }
  return null;
};
