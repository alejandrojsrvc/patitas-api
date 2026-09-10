import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryService } from './application/inventory.service';
import { INVENTORY_REPOSITORY, type InventoryRepository } from './domain/inventory.repository';
import { PrismaInventoryRepository } from './infrastructure/prisma-inventory.repository';
import { InventoryController } from './presentation/inventory.controller';
import { CATALOG_CACHE_INVALIDATION, type CatalogCacheInvalidationPort } from '../../shared/application/ports/catalog-cache-invalidation.port';
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InventoryController],
  providers: [
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
    {
      provide: InventoryService,
      inject: [INVENTORY_REPOSITORY, CATALOG_CACHE_INVALIDATION],
      useFactory: (repository: InventoryRepository, cacheInvalidation: CatalogCacheInvalidationPort) =>
        new InventoryService(repository, cacheInvalidation),
    },
  ],
})
export class InventoryModule {}
