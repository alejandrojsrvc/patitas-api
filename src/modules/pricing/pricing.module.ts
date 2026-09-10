import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PricingService } from './application/pricing.service';
import { PricingCalculator } from './domain/pricing-calculator';
import { PricingScenarioCalculator } from './domain/pricing-scenario-calculator';
import { PRICING_REPOSITORY, type PricingRepository } from './domain/repositories/pricing.repository';
import { PrismaPricingRepository } from './infrastructure/persistence/prisma-pricing.repository';
import { AdminPricingController } from './presentation/admin-pricing.controller';
import { CATALOG_CACHE_INVALIDATION, type CatalogCacheInvalidationPort } from '../../shared/application/ports/catalog-cache-invalidation.port';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminPricingController],
  providers: [
    PricingCalculator,
    PricingScenarioCalculator,
    { provide: PRICING_REPOSITORY, useClass: PrismaPricingRepository },
    {
      provide: PricingService,
      inject: [PRICING_REPOSITORY, PricingCalculator, CATALOG_CACHE_INVALIDATION],
      useFactory: (repository: PricingRepository, calculator: PricingCalculator, cacheInvalidation: CatalogCacheInvalidationPort) =>
        new PricingService(repository, calculator, cacheInvalidation),
    },
  ],
  exports: [PricingService, PricingCalculator],
})
export class PricingModule {}
