import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { PricingService } from '../pricing/application/pricing.service';
import { DashboardService } from './application/dashboard.service';
import { DashboardController } from './presentation/dashboard.controller';
import {
  DASHBOARD_REPOSITORY,
  type DashboardRepository,
} from './domain/dashboard.types';
import { PrismaDashboardRepository } from './infrastructure/prisma-dashboard.repository';

@Module({
  imports: [PrismaModule, AuthModule, PricingModule],
  controllers: [DashboardController],
  providers: [
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
    {
      provide: DashboardService,
      inject: [DASHBOARD_REPOSITORY, PricingService],
      useFactory: (repository: DashboardRepository, pricing: PricingService) =>
        new DashboardService(repository, pricing),
    },
  ],
})
export class DashboardModule {}
