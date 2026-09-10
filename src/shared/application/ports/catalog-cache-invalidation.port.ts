export type CatalogCacheInvalidation =
  { scope: 'catalog' | 'products' | 'facets' | 'images' } | { scope: 'product' | 'brand' | 'category'; slug: string };

export interface CatalogCacheInvalidationPort {
  invalidate(input: CatalogCacheInvalidation | readonly CatalogCacheInvalidation[]): Promise<void>;
}

export const CATALOG_CACHE_INVALIDATION = Symbol('CATALOG_CACHE_INVALIDATION');

export const catalogCacheKeys = (input: CatalogCacheInvalidation | readonly CatalogCacheInvalidation[]): string[] => {
  const invalidations: readonly CatalogCacheInvalidation[] = Array.isArray(input) ? input : [input as CatalogCacheInvalidation];
  const keys = new Set<string>();

  for (const invalidation of invalidations) {
    switch (invalidation.scope) {
      case 'catalog':
      case 'category':
      case 'brand':
      case 'products':
      case 'facets':
      case 'images':
        keys.add('catalog');
        break;
      case 'product':
        keys.add(`product:${invalidation.slug}`);
        keys.add('catalog');
        break;
    }
  }

  return keys.has('catalog') ? ['catalog'] : [...keys].sort();
};
