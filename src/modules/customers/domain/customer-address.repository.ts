import type {
  CreateCustomerAddressInput,
  CustomerAddress,
  UpdateCustomerAddressInput,
} from './customer.types';

export const CUSTOMER_ADDRESS_REPOSITORY = Symbol(
  'CUSTOMER_ADDRESS_REPOSITORY',
);

export interface CustomerAddressRepository {
  list(customerId: string): Promise<CustomerAddress[]>;
  create(
    customerId: string,
    input: CreateCustomerAddressInput,
  ): Promise<CustomerAddress>;
  update(
    id: string,
    customerId: string,
    input: UpdateCustomerAddressInput,
  ): Promise<CustomerAddress>;
  delete(id: string, customerId: string): Promise<void>;
}
