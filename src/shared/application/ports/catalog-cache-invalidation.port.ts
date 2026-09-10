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
        keys.add('catalog');
        break;
      case 'products':
        addProductGroups(keys);
        break;
      case 'facets':
        keys.add('catalog:list');
        keys.add('catalog:taxonomy');
        break;
      case 'images':
        keys.add('catalog:products');
        keys.add('catalog:list');
        keys.add('catalog:home');
        break;
      case 'product':
        keys.add(`product:${invalidation.slug}`);
        addProductGroups(keys);
        break;
      case 'brand':
        keys.add(`brand:${invalidation.slug}`);
        keys.add('catalog:brands');
        keys.add('catalog:list');
        keys.add('catalog:home');
        keys.add('catalog:sitemap');
        break;
    }
  }

  return keys.has('catalog') ? ['catalog'] : [...keys].sort();
};

const addProductGroups = (keys: Set<string>): void => {
  keys.add('catalog:products');
  keys.add('catalog:brands');
  keys.add('catalog:list');
  keys.add('catalog:home');
  keys.add('catalog:sitemap');
  keys.add('catalog:calculator');
};
