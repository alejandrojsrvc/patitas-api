import { Global, Module } from '@nestjs/common';
import { CATALOG_CACHE_INVALIDATION } from '../../shared/application/ports/catalog-cache-invalidation.port';
import { HttpCatalogCacheInvalidationAdapter } from './http-catalog-cache-invalidation.adapter';

@Global()
@Module({
  providers: [
    {
      provide: CATALOG_CACHE_INVALIDATION,
      useClass: HttpCatalogCacheInvalidationAdapter,
    },
  ],
  exports: [CATALOG_CACHE_INVALIDATION],
})
export class CatalogCacheModule {}
