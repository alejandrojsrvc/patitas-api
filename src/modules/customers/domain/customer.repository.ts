import type {
  CreateCustomerInput,
  Customer,
  CustomerFilter,
  CustomerPage,
  CustomerProfile,
  UpdateCustomerInput,
  UpdateCustomerProfileInput,
} from './customer.types';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

export interface CustomerRepository {
  list(filter: CustomerFilter): Promise<CustomerPage>;
  findById(id: string): Promise<Customer | null>;
  findByUserId(userId: string): Promise<Customer | null>;
  findProfileByUserId(userId: string): Promise<CustomerProfile | null>;
  ensureProfileByUserId(
    userId: string,
    input: { fullName: string; email: string },
  ): Promise<CustomerProfile>;
  create(input: CreateCustomerInput): Promise<Customer>;
  update(id: string, input: UpdateCustomerInput): Promise<Customer>;
  updateProfile(
    id: string,
    input: UpdateCustomerProfileInput,
  ): Promise<CustomerProfile>;
}
