import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FulfillmentService } from './application/fulfillment.service';
import {
  FULFILLMENT_REPOSITORY,
  type FulfillmentRepository,
} from './domain/fulfillment.types';
import { PrismaFulfillmentRepository } from './infrastructure/persistence/prisma-fulfillment.repository';
import { AdminFulfillmentController } from './presentation/admin-fulfillment.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminFulfillmentController],
  providers: [
    { provide: FULFILLMENT_REPOSITORY, useClass: PrismaFulfillmentRepository },
    {
      provide: FulfillmentService,
      inject: [FULFILLMENT_REPOSITORY],
      useFactory: (repository: FulfillmentRepository) =>
        new FulfillmentService(repository),
    },
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
