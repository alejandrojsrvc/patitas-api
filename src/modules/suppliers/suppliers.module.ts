import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SupplierService } from './application/supplier.service';
import { SUPPLIER_REPOSITORY, type SupplierRepository } from './domain/repositories/supplier.repository';
import { PrismaSupplierRepository } from './infrastructure/persistence/prisma-supplier.repository';
import { AdminSuppliersController } from './presentation/admin-suppliers.controller';
import { CATALOG_CACHE_INVALIDATION, type CatalogCacheInvalidationPort } from '../../shared/application/ports/catalog-cache-invalidation.port';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminSuppliersController],
  providers: [
    { provide: SUPPLIER_REPOSITORY, useClass: PrismaSupplierRepository },
    {
      provide: SupplierService,
      inject: [SUPPLIER_REPOSITORY, CATALOG_CACHE_INVALIDATION],
      useFactory: (repository: SupplierRepository, cacheInvalidation: CatalogCacheInvalidationPort) =>
        new SupplierService(repository, cacheInvalidation),
    },
  ],
  exports: [SUPPLIER_REPOSITORY, SupplierService],
})
export class SuppliersModule {}
