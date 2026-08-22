import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { STORAGE_PROVIDER, type StorageProvider } from '../../shared/application/ports/storage-provider.interface';
import { CheckoutService } from './application/checkout.service';
import { CHECKOUT_REPOSITORY, type CheckoutRepository } from './domain/checkout.repository';
import { PrismaCheckoutRepository } from './infrastructure/prisma-checkout.repository';
import { CheckoutController } from './presentation/checkout.controller';
import { CustomerOrdersController } from './presentation/customer-orders.controller';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentService } from '../payments/application/payment.service';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, ShippingModule, StorageModule, PaymentsModule],
  controllers: [CheckoutController, CustomerOrdersController],
  providers: [{ provide: CHECKOUT_REPOSITORY, useClass: PrismaCheckoutRepository }, { provide: CheckoutService, inject: [CHECKOUT_REPOSITORY, STORAGE_PROVIDER, PaymentService], useFactory: (repository: CheckoutRepository, storage: StorageProvider, payments: PaymentService) => new CheckoutService(repository, storage, payments) }],
  exports: [CheckoutService],
})
export class CheckoutModule {}
