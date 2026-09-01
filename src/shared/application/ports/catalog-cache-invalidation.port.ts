export type CatalogCacheInvalidation =
  | { scope: 'catalog' | 'products' | 'facets' | 'images' }
  | { scope: 'product' | 'brand' | 'category'; slug: string };

export interface CatalogCacheInvalidationPort {
  invalidate(input: CatalogCacheInvalidation): Promise<void>;
}

export const CATALOG_CACHE_INVALIDATION = Symbol('CATALOG_CACHE_INVALIDATION');
