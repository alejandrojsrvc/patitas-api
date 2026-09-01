import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../shared/application/ports/storage-provider.interface';
import { AuthModule } from '../auth/auth.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { SupplierService } from '../suppliers/application/supplier.service';
import { PromotionsModule } from '../promotions/promotions.module';
import { PromotionService } from '../promotions/application/promotion.service';
import { ShippingModule } from '../shipping/shipping.module';
import { CustomersModule } from '../customers/customers.module';
import { ShippingService } from '../shipping/application/shipping.service';
import { CustomerService } from '../customers/application/customer.service';
import { FulfillmentModule } from '../fulfillment/fulfillment.module';
import { FulfillmentService } from '../fulfillment/application/fulfillment.service';
import { HttpCatalogCacheInvalidationAdapter } from '../../infrastructure/cache/http-catalog-cache-invalidation.adapter';
import {
  CATALOG_CACHE_INVALIDATION,
  type CatalogCacheInvalidationPort,
} from '../../shared/application/ports/catalog-cache-invalidation.port';
import { CatalogService } from './application/catalog.service';
import { MobileCatalogService } from './application/mobile-catalog.service';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from './domain/repositories/catalog.repository';
import { PrismaCatalogRepository } from './infrastructure/persistence/prisma-catalog.repository';
import { AdminCatalogController } from './presentation/controllers/admin-catalog.controller';
import { PublicCatalogController } from './presentation/controllers/public-catalog.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    PromotionsModule,
    SuppliersModule,
    ShippingModule,
    CustomersModule,
    FulfillmentModule,
  ],
  controllers: [PublicCatalogController, AdminCatalogController],
  providers: [
    { provide: CATALOG_REPOSITORY, useClass: PrismaCatalogRepository },
    {
      provide: CATALOG_CACHE_INVALIDATION,
      useClass: HttpCatalogCacheInvalidationAdapter,
    },
    {
      provide: CatalogService,
      inject: [
        CATALOG_REPOSITORY,
        STORAGE_PROVIDER,
        SupplierService,
        FulfillmentService,
        CATALOG_CACHE_INVALIDATION,
      ],
      useFactory: (
        repository: CatalogRepository,
        storage: StorageProvider,
        supplierOffers: SupplierService,
        fulfillment: FulfillmentService,
        cacheInvalidation: CatalogCacheInvalidationPort,
      ) =>
        new CatalogService(
          repository,
          storage,
          supplierOffers,
          fulfillment,
          cacheInvalidation,
        ),
    },
    {
      provide: MobileCatalogService,
      inject: [
        CATALOG_REPOSITORY,
        CatalogService,
        PromotionService,
        ShippingService,
        CustomerService,
      ],
      useFactory: (
        repository: CatalogRepository,
        catalog: CatalogService,
        promotions: PromotionService,
        shipping: ShippingService,
        customers: CustomerService,
      ) =>
        new MobileCatalogService(
          repository,
          catalog,
          promotions,
          shipping,
          customers,
        ),
    },
  ],
  exports: [CATALOG_REPOSITORY, CatalogService, MobileCatalogService],
})
export class CatalogModule {}
