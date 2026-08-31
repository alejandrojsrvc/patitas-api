import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CartService } from '../cart/application/cart.service';
import { CheckoutModule } from '../checkout/checkout.module';
import { CheckoutService } from '../checkout/application/checkout.service';
import { CustomersModule } from '../customers/customers.module';
import { CustomerAddressService } from '../customers/application/customer-address.service';
import { CustomerService } from '../customers/application/customer.service';
import { PetsModule } from '../pets/pets.module';
import { PetService } from '../pets/application/pet.service';
import { ReplenishmentModule } from '../replenishment/replenishment.module';
import { ReplenishmentService } from '../replenishment/application/replenishment.service';
import { AccountQueryService } from './application/account-query.service';
import { StorefrontQueryService } from './application/storefront-query.service';
import {
  AccountController,
  CartScreenController,
  StorefrontController,
} from './presentation/storefront.controller';

@Module({
  imports: [
    AuthModule,
    CartModule,
    CheckoutModule,
    CustomersModule,
    PetsModule,
    ReplenishmentModule,
  ],
  controllers: [StorefrontController, AccountController, CartScreenController],
  providers: [
    {
      provide: StorefrontQueryService,
      inject: [CustomerService, CustomerAddressService, CartService],
      useFactory: (
        customers: CustomerService,
        addresses: CustomerAddressService,
        carts: CartService,
      ) => new StorefrontQueryService(customers, addresses, carts),
    },
    {
      provide: AccountQueryService,
      inject: [
        CustomerService,
        CustomerAddressService,
        CheckoutService,
        PetService,
        ReplenishmentService,
        CartService,
      ],
      useFactory: (
        customers: CustomerService,
        addresses: CustomerAddressService,
        checkout: CheckoutService,
        pets: PetService,
        replenishments: ReplenishmentService,
        carts: CartService,
      ) =>
        new AccountQueryService(
          customers,
          addresses,
          checkout,
          pets,
          replenishments,
          carts,
        ),
    },
  ],
})
export class StorefrontModule {}
