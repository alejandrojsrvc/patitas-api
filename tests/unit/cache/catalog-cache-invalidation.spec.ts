import { catalogCacheKeys } from '../../../src/shared/application/ports/catalog-cache-invalidation.port';

describe('catalogCacheKeys', () => {
  it('maps a product to its detail and shared catalog surfaces', () => {
    expect(catalogCacheKeys({ scope: 'product', slug: 'royal-canin-mini-adult' })).toEqual(['catalog']);
  });

  it('deduplicates a batch and lets a full catalog purge subsume granular keys', () => {
    expect(catalogCacheKeys([{ scope: 'product', slug: 'royal-canin-mini-adult' }, { scope: 'catalog' }, { scope: 'facets' }])).toEqual(['catalog']);
  });

  it('keeps brand invalidation bounded', () => {
    expect(catalogCacheKeys({ scope: 'brand', slug: 'royal-canin' })).toEqual(['catalog']);
  });
});
