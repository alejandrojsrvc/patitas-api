import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { ShippingModule } from '../shipping/shipping.module';
import { ShippingService } from '../shipping/application/shipping.service';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../shared/application/ports/storage-provider.interface';
import { CheckoutService } from './application/checkout.service';
import { CheckoutBootstrapService } from './application/checkout-bootstrap.service';
import {
  CHECKOUT_REPOSITORY,
  type CheckoutRepository,
} from './domain/checkout.repository';
import { PrismaCheckoutRepository } from './infrastructure/prisma-checkout.repository';
import { CheckoutController } from './presentation/checkout.controller';
import { CustomerOrdersController } from './presentation/customer-orders.controller';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentService } from '../payments/application/payment.service';
import { PaymentProviderConfigurationService } from '../payments/application/payment-provider-configuration.service';
import { CustomerAddressService } from '../customers/application/customer-address.service';
import { CheckoutHandoffService } from './application/checkout-handoff.service';
import {
  CHECKOUT_HANDOFF_REPOSITORY,
  type CheckoutHandoffRepository,
} from './domain/checkout-handoff.repository';
import { PrismaCheckoutHandoffRepository } from './infrastructure/prisma-checkout-handoff.repository';
import { CheckoutHandoffController } from './presentation/checkout-handoff.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CustomersModule,
    ShippingModule,
    StorageModule,
    PaymentsModule,
  ],
  controllers: [
    CheckoutController,
    CustomerOrdersController,
    CheckoutHandoffController,
  ],
  providers: [
    { provide: CHECKOUT_REPOSITORY, useClass: PrismaCheckoutRepository },
    {
      provide: CheckoutService,
      inject: [
        CHECKOUT_REPOSITORY,
        STORAGE_PROVIDER,
        PaymentService,
        ShippingService,
      ],
      useFactory: (
        repository: CheckoutRepository,
        storage: StorageProvider,
        payments: PaymentService,
        shipping: ShippingService,
      ) => new CheckoutService(repository, storage, payments, shipping),
    },
    {
      provide: CheckoutBootstrapService,
      inject: [
        CheckoutService,
        CustomerAddressService,
        PaymentProviderConfigurationService,
      ],
      useFactory: (
        checkout: CheckoutService,
        addresses: CustomerAddressService,
        paymentConfigurations: PaymentProviderConfigurationService,
      ) =>
        new CheckoutBootstrapService(
          checkout,
          addresses,
          paymentConfigurations,
        ),
    },
    {
      provide: CHECKOUT_HANDOFF_REPOSITORY,
      useClass: PrismaCheckoutHandoffRepository,
    },
    {
      provide: CheckoutHandoffService,
      inject: [CHECKOUT_HANDOFF_REPOSITORY],
      useFactory: (repository: CheckoutHandoffRepository) =>
        new CheckoutHandoffService(repository),
    },
  ],
  exports: [CheckoutService, CheckoutBootstrapService, CheckoutHandoffService],
})
export class CheckoutModule {}
