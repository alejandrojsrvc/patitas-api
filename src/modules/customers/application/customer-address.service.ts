import { CustomerValidationError } from '../domain/customer.error';
import type { CustomerAddressRepository } from '../domain/customer-address.repository';
import type {
  CreateCustomerAddressInput,
  UpdateCustomerAddressInput,
} from '../domain/customer.types';
import type { CustomerService } from './customer.service';

export class CustomerAddressService {
  public constructor(
    private readonly repository: CustomerAddressRepository,
    private readonly customers: CustomerService,
  ) {}

  public async listForUser(userId: string) {
    return this.repository.list((await this.customers.findByUserId(userId)).id);
  }

  public listForUserByCustomerId(customerId: string) {
    return this.repository.list(customerId);
  }

  public async createForUser(
    userId: string,
    input: CreateCustomerAddressInput,
  ) {
    const customer = await this.customers.findByUserId(userId);
    validateAddress(input);
    return this.repository.create(customer.id, normalizeAddress(input));
  }

  public async updateForUser(
    userId: string,
    id: string,
    input: UpdateCustomerAddressInput,
  ) {
    const customer = await this.customers.findByUserId(userId);
    validateAddress(input);
    return this.repository.update(id, customer.id, normalizeAddress(input));
  }

  public async deleteForUser(userId: string, id: string) {
    const customer = await this.customers.findByUserId(userId);
    return this.repository.delete(id, customer.id);
  }
}

const validateAddress = (input: Partial<CreateCustomerAddressInput>): void => {
  for (const field of [
    'label',
    'recipientName',
    'street',
    'number',
    'city',
    'province',
    'postalCode',
  ] as const) {
    if (input[field] !== undefined && !input[field].trim()) {
      throw new CustomerValidationError(`El campo ${field} es obligatorio.`);
    }
  }
};

const normalizeAddress = <
  T extends CreateCustomerAddressInput | UpdateCustomerAddressInput,
>(
  input: T,
): T => ({
  ...input,
  ...Object.fromEntries(
    [
      'label',
      'recipientName',
      'phone',
      'street',
      'number',
      'apartment',
      'neighborhood',
      'city',
      'province',
      'postalCode',
      'reference',
    ]
      .filter((field) => input[field as keyof T] !== undefined)
      .map((field) => [
        field,
        String(input[field as keyof T] ?? '').trim() || null,
      ]),
  ),
});
