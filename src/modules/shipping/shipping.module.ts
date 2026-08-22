import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ShippingService } from './application/shipping.service';
import {
  SHIPPING_REPOSITORY,
  type ShippingRepository,
} from './domain/shipping.repository';
import { PrismaShippingRepository } from './infrastructure/prisma-shipping.repository';
import { ShippingController } from './presentation/shipping.controller';
import { PublicShippingController } from './presentation/public-shipping.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ShippingController, PublicShippingController],
  providers: [
    { provide: SHIPPING_REPOSITORY, useClass: PrismaShippingRepository },
    {
      provide: ShippingService,
      inject: [SHIPPING_REPOSITORY],
      useFactory: (repository: ShippingRepository) =>
        new ShippingService(repository),
    },
  ],
  exports: [ShippingService, SHIPPING_REPOSITORY],
})
export class ShippingModule {}
