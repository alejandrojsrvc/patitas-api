import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../shared/application/ports/storage-provider.interface';
import { CustomerService } from '../customers/application/customer.service';
import { OrderService } from './application/order.service';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from './domain/order.repository';
import { PrismaOrderRepository } from './infrastructure/prisma-order.repository';
import { AdminOrderController } from './presentation/admin-order.controller';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, StorageModule],
  controllers: [AdminOrderController],
  providers: [
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
    {
      provide: OrderService,
      inject: [ORDER_REPOSITORY, CustomerService, STORAGE_PROVIDER],
      useFactory: (
        repository: OrderRepository,
        customers: CustomerService,
        storage: StorageProvider,
      ) => new OrderService(repository, customers, storage),
    },
  ],
})
export class OrdersModule {}
