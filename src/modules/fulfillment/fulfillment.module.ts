import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FulfillmentService } from './application/fulfillment.service';
import { FULFILLMENT_REPOSITORY, type FulfillmentRepository } from './domain/fulfillment.types';
import { PrismaFulfillmentRepository } from './infrastructure/persistence/prisma-fulfillment.repository';
import { AdminFulfillmentController } from './presentation/admin-fulfillment.controller';
import { ShipmentController } from './presentation/shipment.controller';
import { ShipmentService } from './application/shipment.service';
import { CustomerClaimService } from './application/customer-claim.service';
import { FULFILLMENT_OPERATIONS_REPOSITORY, type FulfillmentOperationsRepository } from './domain/fulfillment-operations.types';
import { PrismaFulfillmentOperationsRepository } from './infrastructure/persistence/prisma-fulfillment-operations.repository';
import { CustomersModule } from '../customers/customers.module';
import { CATALOG_CACHE_INVALIDATION, type CatalogCacheInvalidationPort } from '../../shared/application/ports/catalog-cache-invalidation.port';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule],
  controllers: [AdminFulfillmentController, ShipmentController],
  providers: [
    { provide: FULFILLMENT_REPOSITORY, useClass: PrismaFulfillmentRepository },
    { provide: FULFILLMENT_OPERATIONS_REPOSITORY, useClass: PrismaFulfillmentOperationsRepository },
    {
      provide: FulfillmentService,
      inject: [FULFILLMENT_REPOSITORY, CATALOG_CACHE_INVALIDATION],
      useFactory: (repository: FulfillmentRepository, cacheInvalidation: CatalogCacheInvalidationPort) =>
        new FulfillmentService(repository, cacheInvalidation),
    },
    {
      provide: ShipmentService,
      inject: [FULFILLMENT_OPERATIONS_REPOSITORY],
      useFactory: (repository: FulfillmentOperationsRepository) => new ShipmentService(repository),
    },
    {
      provide: CustomerClaimService,
      inject: [FULFILLMENT_OPERATIONS_REPOSITORY],
      useFactory: (repository: FulfillmentOperationsRepository) => new CustomerClaimService(repository),
    },
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
