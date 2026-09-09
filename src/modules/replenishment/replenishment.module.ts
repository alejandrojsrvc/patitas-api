import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/application/catalog.service';
import { CustomersModule } from '../customers/customers.module';
import { CartModule } from '../cart/cart.module';
import { PetsModule } from '../pets/pets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EstimateService } from './application/estimate.service';
import { REPLENISHMENT_ESTIMATE_REPOSITORY, type ReplenishmentEstimateRepository } from './domain/estimate.repository';
import { PrismaEstimateRepository } from './infrastructure/prisma-estimate.repository';
import { EstimateController } from './presentation/estimate.controller';
import { MobileEstimateController } from './presentation/mobile-estimate.controller';
import { MobileReplenishmentController } from './presentation/mobile-replenishment.controller';
import { ReplenishmentService } from './application/replenishment.service';
import { REPLENISHMENT_REPOSITORY, type ReplenishmentRepository } from './domain/replenishment.repository';
import { PrismaReplenishmentRepository } from './infrastructure/prisma-replenishment.repository';
import { ReplenishmentController } from './presentation/replenishment.controller';
import { ReplenishmentReminderController } from './presentation/reminder.controller';
import { ReplenishmentReminderService } from './application/reminder.service';
import { REPLENISHMENT_REMINDER_REPOSITORY, type ReplenishmentReminderRepository } from './domain/reminder.repository';
import { PrismaReplenishmentReminderRepository } from './infrastructure/prisma-reminder.repository';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, CatalogModule, CartModule, PetsModule, NotificationsModule],
  controllers: [
    ReplenishmentController,
    EstimateController,
    MobileEstimateController,
    MobileReplenishmentController,
    ReplenishmentReminderController,
  ],
  providers: [
    {
      provide: REPLENISHMENT_REPOSITORY,
      useClass: PrismaReplenishmentRepository,
    },
    {
      provide: ReplenishmentService,
      inject: [REPLENISHMENT_REPOSITORY],
      useFactory: (repository: ReplenishmentRepository) => new ReplenishmentService(repository),
    },
    {
      provide: REPLENISHMENT_ESTIMATE_REPOSITORY,
      useClass: PrismaEstimateRepository,
    },
    {
      provide: EstimateService,
      inject: [REPLENISHMENT_ESTIMATE_REPOSITORY, CatalogService],
      useFactory: (repository: ReplenishmentEstimateRepository, catalog: CatalogService) => new EstimateService(repository, catalog),
    },
    {
      provide: REPLENISHMENT_REMINDER_REPOSITORY,
      useClass: PrismaReplenishmentReminderRepository,
    },
    {
      provide: ReplenishmentReminderService,
      inject: [REPLENISHMENT_REMINDER_REPOSITORY],
      useFactory: (repository: ReplenishmentReminderRepository) => new ReplenishmentReminderService(repository),
    },
  ],
  exports: [ReplenishmentService],
})
export class ReplenishmentModule {}
