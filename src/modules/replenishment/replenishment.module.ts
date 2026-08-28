import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/application/catalog.service';
import { CustomersModule } from '../customers/customers.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { PetsModule } from '../pets/pets.module';
import { EstimateService } from './application/estimate.service';
import {
  REPLENISHMENT_ESTIMATE_REPOSITORY,
  type ReplenishmentEstimateRepository,
} from './domain/estimate.repository';
import { PrismaEstimateRepository } from './infrastructure/prisma-estimate.repository';
import { EstimateController } from './presentation/estimate.controller';
import { MobileReplenishmentController } from './presentation/mobile-replenishment.controller';
import { ReplenishmentService } from './application/replenishment.service';
import {
  REPLENISHMENT_REPOSITORY,
  type ReplenishmentRepository,
} from './domain/replenishment.repository';
import { PrismaReplenishmentRepository } from './infrastructure/prisma-replenishment.repository';
import { ReplenishmentController } from './presentation/replenishment.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CustomersModule,
    CatalogModule,
    CheckoutModule,
    PetsModule,
  ],
  controllers: [
    ReplenishmentController,
    EstimateController,
    MobileReplenishmentController,
  ],
  providers: [
    {
      provide: REPLENISHMENT_REPOSITORY,
      useClass: PrismaReplenishmentRepository,
    },
    {
      provide: ReplenishmentService,
      inject: [REPLENISHMENT_REPOSITORY],
      useFactory: (repository: ReplenishmentRepository) =>
        new ReplenishmentService(repository),
    },
    {
      provide: REPLENISHMENT_ESTIMATE_REPOSITORY,
      useClass: PrismaEstimateRepository,
    },
    {
      provide: EstimateService,
      inject: [REPLENISHMENT_ESTIMATE_REPOSITORY, CatalogService],
      useFactory: (
        repository: ReplenishmentEstimateRepository,
        catalog: CatalogService,
      ) => new EstimateService(repository, catalog),
    },
  ],
  exports: [ReplenishmentService],
})
export class ReplenishmentModule {}
