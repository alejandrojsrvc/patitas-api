import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { PaymentInfrastructureModule } from '../../infrastructure/payments/payment.module';
import { CustomersModule } from '../customers/customers.module';
import { AuthModule } from '../auth/auth.module';
import { MarketingModule } from '../marketing/marketing.module';
import { MarketingService } from '../marketing/application/marketing.service';
import { PaymentService } from './application/payment.service';
import {
  PAYMENT_PROVIDER_RESOLVER,
  type PaymentProviderResolver,
} from '../../shared/application/ports/payment-provider.interface';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from './domain/payment.repository';
import { PrismaPaymentRepository } from './infrastructure/prisma-payment.repository';
import { PaymentController } from './presentation/payment.controller';
import { AdminPaymentProviderController } from './presentation/admin-payment-provider.controller';
import { PaymentProviderConfigurationService } from './application/payment-provider-configuration.service';
import {
  PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY,
  type PaymentProviderConfigurationRepository,
} from './domain/payment-provider-configuration.repository';
import { PrismaPaymentProviderConfigurationRepository } from './infrastructure/prisma-payment-provider-configuration.repository';

@Module({
  imports: [
    PrismaModule,
    PaymentInfrastructureModule,
    CustomersModule,
    AuthModule,
    MarketingModule,
  ],
  controllers: [PaymentController, AdminPaymentProviderController],
  providers: [
    {
      provide: PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY,
      useClass: PrismaPaymentProviderConfigurationRepository,
    },
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    {
      provide: PaymentService,
      inject: [
        PAYMENT_REPOSITORY,
        MarketingService,
        PAYMENT_PROVIDER_RESOLVER,
        PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY,
      ],
      useFactory: (
        repository: PaymentRepository,
        marketing: MarketingService,
        providers: PaymentProviderResolver,
        configurations: PaymentProviderConfigurationRepository,
      ) => new PaymentService(repository, marketing, providers, configurations),
    },
    {
      provide: PaymentProviderConfigurationService,
      inject: [
        PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY,
        PAYMENT_PROVIDER_RESOLVER,
      ],
      useFactory: (
        configurations: PaymentProviderConfigurationRepository,
        providers: PaymentProviderResolver,
      ) => new PaymentProviderConfigurationService(configurations, providers),
    },
  ],
  exports: [PaymentService, PaymentProviderConfigurationService],
})
export class PaymentsModule {}
