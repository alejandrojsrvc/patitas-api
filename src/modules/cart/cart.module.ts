import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { STORAGE_PROVIDER, type StorageProvider } from '../../shared/application/ports/storage-provider.interface';
import { CartService } from './application/cart.service';
import { CART_REPOSITORY, type CartRepository } from './domain/cart.repository';
import { PrismaCartRepository } from './infrastructure/prisma-cart.repository';
import { AdminCartController } from './presentation/admin-cart.controller';
import { CartController } from './presentation/cart.controller';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, StorageModule],
  controllers: [CartController, AdminCartController],
  providers: [
    { provide: CART_REPOSITORY, useClass: PrismaCartRepository },
    {
      provide: CartService,
      inject: [CART_REPOSITORY, STORAGE_PROVIDER],
      useFactory: (repository: CartRepository, storage: StorageProvider) => new CartService(repository, storage),
    },
  ],
  exports: [CartService, CART_REPOSITORY],
})
export class CartModule {}
