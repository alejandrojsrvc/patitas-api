import { catalogCacheKeys } from '../../../src/shared/application/ports/catalog-cache-invalidation.port';

describe('catalogCacheKeys', () => {
  it('maps a product to its detail and shared catalog surfaces', () => {
    expect(catalogCacheKeys({ scope: 'product', slug: 'royal-canin-mini-adult' })).toEqual([
      'catalog:brands',
      'catalog:calculator',
      'catalog:home',
      'catalog:list',
      'catalog:products',
      'catalog:sitemap',
      'product:royal-canin-mini-adult',
    ]);
  });

  it('deduplicates a batch and lets a full catalog purge subsume granular keys', () => {
    expect(
      catalogCacheKeys([
        { scope: 'product', slug: 'royal-canin-mini-adult' },
        { scope: 'catalog' },
        { scope: 'facets' },
      ]),
    ).toEqual(['catalog']);
  });

  it('keeps brand invalidation bounded', () => {
    expect(catalogCacheKeys({ scope: 'brand', slug: 'royal-canin' })).toEqual([
      'brand:royal-canin',
      'catalog:brands',
      'catalog:home',
      'catalog:list',
      'catalog:sitemap',
    ]);
  });
});
