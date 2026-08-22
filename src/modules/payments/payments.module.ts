import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { PaymentInfrastructureModule } from '../../infrastructure/payments/payment.module';
import { CustomersModule } from '../customers/customers.module';
import { AuthModule } from '../auth/auth.module';
import { MarketingModule } from '../marketing/marketing.module';
import { MarketingService } from '../marketing/application/marketing.service';
import { PaymentService } from './application/payment.service';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from './domain/payment.repository';
import { PrismaPaymentRepository } from './infrastructure/prisma-payment.repository';
import { PaymentController } from './presentation/payment.controller';

@Module({
  imports: [
    PrismaModule,
    PaymentInfrastructureModule,
    CustomersModule,
    AuthModule,
    MarketingModule,
  ],
  controllers: [PaymentController],
  providers: [
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    {
      provide: PaymentService,
      inject: [PAYMENT_REPOSITORY, MarketingService],
      useFactory: (
        repository: PaymentRepository,
        marketing: MarketingService,
      ) => new PaymentService(repository, marketing),
    },
  ],
  exports: [PaymentService],
})
export class PaymentsModule {}
