import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { PurchaseScheduleController } from './presentation/purchase-schedule.controller';
import { AdminPurchaseScheduleController } from './presentation/admin-purchase-schedule.controller';
import { PurchaseScheduleService } from './application/purchase-schedule.service';
import { PURCHASE_SCHEDULE_REPOSITORY } from './domain/purchase-schedule.repository';
import { PrismaPurchaseScheduleRepository } from './infrastructure/prisma-purchase-schedule.repository';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule],
  controllers: [PurchaseScheduleController, AdminPurchaseScheduleController],
  providers: [
    {
      provide: PURCHASE_SCHEDULE_REPOSITORY,
      useClass: PrismaPurchaseScheduleRepository,
    },
    {
      provide: PurchaseScheduleService,
      inject: [PURCHASE_SCHEDULE_REPOSITORY],
      useFactory: (repository: PrismaPurchaseScheduleRepository) => new PurchaseScheduleService(repository),
    },
  ],
  exports: [PurchaseScheduleService],
})
export class PurchaseSchedulesModule {}
