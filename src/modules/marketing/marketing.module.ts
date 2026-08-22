import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MarketingInfrastructureModule } from '../../infrastructure/marketing/marketing.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { MARKETING_PROVIDER, type MarketingProvider } from '../../shared/application/ports/marketing-provider.interface';
import { MarketingService } from './application/marketing.service';
import { MarketingController } from './presentation/marketing.controller';

@Module({ imports: [PrismaModule, MarketingInfrastructureModule, AuthModule, CustomersModule], controllers: [MarketingController], providers: [{ provide: MarketingService, inject: [PrismaService, MARKETING_PROVIDER], useFactory: (prisma: PrismaService, provider: MarketingProvider) => new MarketingService(prisma, provider) }], exports: [MarketingService] })
export class MarketingModule {}
