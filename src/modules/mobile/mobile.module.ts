import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { PrismaMobileAccessRepository } from '../../infrastructure/mobile/prisma-mobile-access.repository';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { PetsModule } from '../pets/pets.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { PaymentsModule } from '../payments/payments.module';
import { MobileAccessService } from './application/mobile-access.service';
import { MobileCheckoutService } from './application/mobile-checkout.service';
import { MobilePaymentService } from './application/mobile-payment.service';
import {
  MOBILE_ACCESS_REPOSITORY,
  type MobileAccessRepository,
} from '../../shared/application/ports/mobile-access.repository';
import { MobileAccessInterceptor } from './presentation/mobile-access.interceptor';
import { MobileAccountController } from './presentation/mobile-account.controller';
import { MobileAuthController } from './presentation/mobile-auth.controller';
import { MobilePetBreedController } from './presentation/mobile-pet-breed.controller';
import { MobilePetController } from './presentation/mobile-pet.controller';
import { MobileCategoriesController } from '../catalog/presentation/mobile/mobile-categories.controller';
import { MobileProductsController } from '../catalog/presentation/mobile/mobile-products.controller';
import { MobileOffersController } from '../catalog/presentation/mobile/mobile-offers.controller';
import { MobileCheckoutController } from './presentation/mobile-checkout.controller';
import { MobilePaymentController } from './presentation/mobile-payment.controller';
import { MobileOrderController } from './presentation/mobile-order.controller';
import { MOBILE_ORDER_REPOSITORY } from './domain/mobile-order.repository';
import { PrismaMobileOrderRepository } from './infrastructure/prisma-mobile-order.repository';
import {
  MOBILE_PAYMENT_METHOD_REPOSITORY,
  type MobilePaymentMethodRepository,
} from './domain/mobile-payment-method.repository';
import { PrismaMobilePaymentMethodRepository } from './infrastructure/prisma-mobile-payment-method.repository';
import { CheckoutService } from '../checkout/application/checkout.service';
import { CustomerAddressService } from '../customers/application/customer-address.service';
import { PaymentService } from '../payments/application/payment.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CustomersModule,
    PetsModule,
    CatalogModule,
    CheckoutModule,
    PaymentsModule,
  ],
  controllers: [
    MobileAuthController,
    MobileAccountController,
    MobilePetController,
    MobilePetBreedController,
    MobileCategoriesController,
    MobileProductsController,
    MobileOffersController,
    MobileCheckoutController,
    MobilePaymentController,
    MobileOrderController,
  ],
  providers: [
    {
      provide: MOBILE_ACCESS_REPOSITORY,
      useClass: PrismaMobileAccessRepository,
    },
    {
      provide: MobileAccessService,
      inject: [MOBILE_ACCESS_REPOSITORY],
      useFactory: (repository: MobileAccessRepository) =>
        new MobileAccessService(repository),
    },
    { provide: APP_INTERCEPTOR, useClass: MobileAccessInterceptor },
    { provide: MOBILE_ORDER_REPOSITORY, useClass: PrismaMobileOrderRepository },
    {
      provide: MOBILE_PAYMENT_METHOD_REPOSITORY,
      useClass: PrismaMobilePaymentMethodRepository,
    },
    {
      provide: MobileCheckoutService,
      inject: [
        CheckoutService,
        CustomerAddressService,
        MOBILE_PAYMENT_METHOD_REPOSITORY,
      ],
      useFactory: (
        checkout: CheckoutService,
        addresses: CustomerAddressService,
        methods: MobilePaymentMethodRepository,
      ) => new MobileCheckoutService(checkout, addresses, methods),
    },
    {
      provide: MobilePaymentService,
      inject: [PaymentService, MOBILE_PAYMENT_METHOD_REPOSITORY],
      useFactory: (
        payments: PaymentService,
        methods: MobilePaymentMethodRepository,
      ) => new MobilePaymentService(payments, methods),
    },
  ],
})
export class MobileModule {}
