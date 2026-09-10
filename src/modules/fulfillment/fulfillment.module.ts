import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FulfillmentService } from './application/fulfillment.service';
import { FULFILLMENT_REPOSITORY, type FulfillmentRepository } from './domain/fulfillment.types';
import { PrismaFulfillmentRepository } from './infrastructure/persistence/prisma-fulfillment.repository';
import { AdminFulfillmentController } from './presentation/admin-fulfillment.controller';
import { CATALOG_CACHE_INVALIDATION, type CatalogCacheInvalidationPort } from '../../shared/application/ports/catalog-cache-invalidation.port';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminFulfillmentController],
  providers: [
    { provide: FULFILLMENT_REPOSITORY, useClass: PrismaFulfillmentRepository },
    {
      provide: FulfillmentService,
      inject: [FULFILLMENT_REPOSITORY, CATALOG_CACHE_INVALIDATION],
      useFactory: (repository: FulfillmentRepository, cacheInvalidation: CatalogCacheInvalidationPort) =>
        new FulfillmentService(repository, cacheInvalidation),
    },
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
