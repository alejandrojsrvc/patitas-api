import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../shared/application/ports/storage-provider.interface';
import { AuthModule } from '../auth/auth.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { CatalogService } from './application/catalog.service';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from './domain/repositories/catalog.repository';
import { PrismaCatalogRepository } from './infrastructure/persistence/prisma-catalog.repository';
import { AdminCatalogController } from './presentation/controllers/admin-catalog.controller';
import { PublicCatalogController } from './presentation/controllers/public-catalog.controller';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule, PromotionsModule],
  controllers: [PublicCatalogController, AdminCatalogController],
  providers: [
    { provide: CATALOG_REPOSITORY, useClass: PrismaCatalogRepository },
    {
      provide: CatalogService,
      inject: [CATALOG_REPOSITORY, STORAGE_PROVIDER],
      useFactory: (repository: CatalogRepository, storage: StorageProvider) =>
        new CatalogService(repository, storage),
    },
  ],
  exports: [CATALOG_REPOSITORY],
})
export class CatalogModule {}
