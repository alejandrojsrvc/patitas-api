import {
  CustomerNotFoundError,
  CustomerValidationError,
} from '../domain/customer.error';
import type { CustomerRepository } from '../domain/customer.repository';
import type {
  CreateCustomerInput,
  CustomerFilter,
  UpdateCustomerInput,
  UpdateCustomerProfileInput,
} from '../domain/customer.types';

export class CustomerService {
  public constructor(private readonly repository: CustomerRepository) {}

  public list(filter: CustomerFilter) {
    return this.repository.list(filter);
  }

  public async find(id: string) {
    const customer = await this.repository.findById(id);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }

  public async findByUserId(userId: string) {
    const customer = await this.repository.findByUserId(userId);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }

  public async updateByUserId(userId: string, input: UpdateCustomerInput) {
    const customer = await this.findByUserId(userId);
    return this.update(customer.id, input);
  }

  public async findProfileByUserId(userId: string) {
    const customer = await this.repository.findProfileByUserId(userId);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }

  public ensureProfileByUserId(
    userId: string,
    input: { fullName: string; email: string },
  ) {
    return this.repository.ensureProfileByUserId(userId, {
      fullName: input.fullName.trim() || input.email,
      email: input.email.trim().toLowerCase(),
    });
  }

  public async updateProfileByUserId(
    userId: string,
    input: UpdateCustomerProfileInput,
  ) {
    const customer = await this.findProfileByUserId(userId);
    validateCustomer(input);
    return this.repository.updateProfile(customer.id, normalizeCustomer(input));
  }

  public create(input: CreateCustomerInput) {
    validateCustomer(input);
    return this.repository.create(normalizeCustomer(input));
  }

  public async update(id: string, input: UpdateCustomerInput) {
    await this.find(id);
    validateCustomer(input);
    return this.repository.update(id, normalizeCustomer(input));
  }
}

const validateCustomer = (
  input: CreateCustomerInput | UpdateCustomerInput | UpdateCustomerProfileInput,
): void => {
  if (input.fullName !== undefined && !input.fullName.trim()) {
    throw new CustomerValidationError('El nombre del cliente es obligatorio.');
  }
  if (
    'email' in input &&
    input.email !== undefined &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
  ) {
    throw new CustomerValidationError('El email del cliente no es válido.');
  }
};

const normalizeCustomer = <
  T extends
    CreateCustomerInput | UpdateCustomerInput | UpdateCustomerProfileInput,
>(
  input: T,
): T => ({
  ...input,
  ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
  ...('email' in input && input.email !== undefined
    ? { email: input.email.trim().toLowerCase() }
    : {}),
  ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
  ...('avatarUrl' in input && input.avatarUrl !== undefined
    ? { avatarUrl: input.avatarUrl?.trim() || null }
    : {}),
});
