import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CustomerService } from './application/customer.service';
import { CustomerAddressService } from './application/customer-address.service';
import { CUSTOMER_REPOSITORY } from './domain/customer.repository';
import { CUSTOMER_ADDRESS_REPOSITORY, type CustomerAddressRepository } from './domain/customer-address.repository';
import { PrismaCustomerRepository } from './infrastructure/prisma-customer.repository';
import { PrismaCustomerAddressRepository } from './infrastructure/prisma-customer-address.repository';
import { AdminCustomerController } from './presentation/customer.controller';
import { CustomerProfileController } from './presentation/customer-profile.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminCustomerController, CustomerProfileController],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    {
      provide: CustomerService,
      inject: [CUSTOMER_REPOSITORY],
      useFactory: (repository: import('./domain/customer.repository').CustomerRepository) => new CustomerService(repository),
    },
    { provide: CUSTOMER_ADDRESS_REPOSITORY, useClass: PrismaCustomerAddressRepository },
    {
      provide: CustomerAddressService,
      inject: [CUSTOMER_ADDRESS_REPOSITORY, CustomerService],
      useFactory: (repository: CustomerAddressRepository, customers: CustomerService) => new CustomerAddressService(repository, customers),
    },
  ],
  exports: [CustomerService],
})
export class CustomersModule {}
