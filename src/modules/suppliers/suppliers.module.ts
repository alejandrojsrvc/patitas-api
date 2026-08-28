import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SupplierService } from './application/supplier.service';
import {
  SUPPLIER_REPOSITORY,
  type SupplierRepository,
} from './domain/repositories/supplier.repository';
import { PrismaSupplierRepository } from './infrastructure/persistence/prisma-supplier.repository';
import { AdminSuppliersController } from './presentation/admin-suppliers.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminSuppliersController],
  providers: [
    { provide: SUPPLIER_REPOSITORY, useClass: PrismaSupplierRepository },
    {
      provide: SupplierService,
      inject: [SUPPLIER_REPOSITORY],
      useFactory: (repository: SupplierRepository) =>
        new SupplierService(repository),
    },
  ],
  exports: [SUPPLIER_REPOSITORY, SupplierService],
})
export class SuppliersModule {}
