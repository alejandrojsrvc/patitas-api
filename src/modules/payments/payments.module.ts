import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { PaymentInfrastructureModule } from '../../infrastructure/payments/payment.module';
import { CustomersModule } from '../customers/customers.module';
import { AuthModule } from '../auth/auth.module';
import { MarketingModule } from '../marketing/marketing.module';
import { MarketingService } from '../marketing/application/marketing.service';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { STORAGE_PROVIDER, type StorageProvider } from '../../shared/application/ports/storage-provider.interface';
import { PaymentService } from './application/payment.service';
import { PAYMENT_PROVIDER_RESOLVER, type PaymentProviderResolver } from '../../shared/application/ports/payment-provider.interface';
import { PAYMENT_REPOSITORY, type PaymentRepository } from './domain/payment.repository';
import { PrismaPaymentRepository } from './infrastructure/prisma-payment.repository';
import { PaymentController } from './presentation/payment.controller';
import { AdminPaymentProviderController } from './presentation/admin-payment-provider.controller';
import { PaymentProviderConfigurationService } from './application/payment-provider-configuration.service';
import {
  PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY,
  type PaymentProviderConfigurationRepository,
} from './domain/payment-provider-configuration.repository';
import { PrismaPaymentProviderConfigurationRepository } from './infrastructure/prisma-payment-provider-configuration.repository';
import { PaymentMethodBenefitService } from './application/payment-method-benefit.service';
import { PAYMENT_METHOD_BENEFIT_REPOSITORY, type PaymentMethodBenefitRepository } from './domain/payment-method-benefit.repository';
import { PrismaPaymentMethodBenefitRepository } from './infrastructure/prisma-payment-method-benefit.repository';
import { AdminPaymentMethodBenefitController } from './presentation/admin-payment-method-benefit.controller';
import { AdminManualTransferController } from './presentation/admin-manual-transfer.controller';

@Module({
  imports: [PrismaModule, PaymentInfrastructureModule, CustomersModule, AuthModule, MarketingModule, StorageModule],
  controllers: [PaymentController, AdminPaymentProviderController, AdminPaymentMethodBenefitController, AdminManualTransferController],
  providers: [
    {
      provide: PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY,
      useClass: PrismaPaymentProviderConfigurationRepository,
    },
    {
      provide: PAYMENT_METHOD_BENEFIT_REPOSITORY,
      useClass: PrismaPaymentMethodBenefitRepository,
    },
    {
      provide: PaymentMethodBenefitService,
      inject: [PAYMENT_METHOD_BENEFIT_REPOSITORY],
      useFactory: (repository: PaymentMethodBenefitRepository) => new PaymentMethodBenefitService(repository),
    },
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    {
      provide: PaymentService,
      inject: [
        PAYMENT_REPOSITORY,
        MarketingService,
        PAYMENT_PROVIDER_RESOLVER,
        PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY,
        PaymentMethodBenefitService,
        STORAGE_PROVIDER,
      ],
      useFactory: (
        repository: PaymentRepository,
        marketing: MarketingService,
        providers: PaymentProviderResolver,
        configurations: PaymentProviderConfigurationRepository,
        benefits: PaymentMethodBenefitService,
        storage: StorageProvider,
      ) => new PaymentService(repository, marketing, providers, configurations, benefits, storage),
    },
    {
      provide: PaymentProviderConfigurationService,
      inject: [PAYMENT_PROVIDER_CONFIGURATION_REPOSITORY, PAYMENT_PROVIDER_RESOLVER, PaymentMethodBenefitService],
      useFactory: (
        configurations: PaymentProviderConfigurationRepository,
        providers: PaymentProviderResolver,
        benefits: PaymentMethodBenefitService,
      ) => new PaymentProviderConfigurationService(configurations, providers, benefits),
    },
  ],
  exports: [PaymentService, PaymentProviderConfigurationService, PaymentMethodBenefitService],
})
export class PaymentsModule {}
