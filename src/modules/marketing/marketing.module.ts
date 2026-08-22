import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { MarketingInfrastructureModule } from '../../infrastructure/marketing/marketing.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import {
  MARKETING_PROVIDER,
  type MarketingProvider,
} from '../../shared/application/ports/marketing-provider.interface';
import { MarketingService } from './application/marketing.service';
import {
  MARKETING_REPOSITORY,
  type MarketingEventRepository,
} from './domain/marketing.repository';
import { PrismaMarketingRepository } from './infrastructure/prisma-marketing.repository';
import { MarketingController } from './presentation/marketing.controller';

@Module({
  imports: [
    PrismaModule,
    MarketingInfrastructureModule,
    AuthModule,
    CustomersModule,
  ],
  controllers: [MarketingController],
  providers: [
    PrismaMarketingRepository,
    { provide: MARKETING_REPOSITORY, useExisting: PrismaMarketingRepository },
    {
      provide: MarketingService,
      inject: [MARKETING_REPOSITORY, MARKETING_PROVIDER],
      useFactory: (
        repository: MarketingEventRepository,
        provider: MarketingProvider,
      ) => new MarketingService(repository, provider),
    },
  ],
  exports: [MarketingService],
})
export class MarketingModule {}
