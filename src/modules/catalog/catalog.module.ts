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
      provide: CatalogService,
      inject: [
        CATALOG_REPOSITORY,
        STORAGE_PROVIDER,
        SupplierService,
        FulfillmentService,
      ],
      useFactory: (
        repository: CatalogRepository,
        storage: StorageProvider,
        supplierOffers: SupplierService,
        fulfillment: FulfillmentService,
      ) => new CatalogService(repository, storage, supplierOffers, fulfillment),
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
