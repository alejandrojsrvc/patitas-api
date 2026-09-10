import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PromotionService } from './application/promotion.service';
import { PROMOTION_REPOSITORY, type PromotionRepository } from './domain/promotion.repository';
import { PrismaPromotionRepository } from './infrastructure/prisma-promotion.repository';
import { PromotionController } from './presentation/promotion.controller';
import { PublicPromotionController } from './presentation/public-promotion.controller';
import { CATALOG_CACHE_INVALIDATION, type CatalogCacheInvalidationPort } from '../../shared/application/ports/catalog-cache-invalidation.port';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PromotionController, PublicPromotionController],
  providers: [
    { provide: PROMOTION_REPOSITORY, useClass: PrismaPromotionRepository },
    {
      provide: PromotionService,
      inject: [PROMOTION_REPOSITORY, CATALOG_CACHE_INVALIDATION],
      useFactory: (repository: PromotionRepository, cacheInvalidation: CatalogCacheInvalidationPort) =>
        new PromotionService(repository, cacheInvalidation),
    },
  ],
  exports: [PromotionService, PROMOTION_REPOSITORY],
})
export class PromotionsModule {}
