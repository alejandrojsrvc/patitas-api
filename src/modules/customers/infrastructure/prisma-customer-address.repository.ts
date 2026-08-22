import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CustomerNotFoundError } from '../domain/customer.error';
import type { CustomerAddressRepository } from '../domain/customer-address.repository';
import type { CreateCustomerAddressInput, CustomerAddress, UpdateCustomerAddressInput } from '../domain/customer.types';

@Injectable()
export class PrismaCustomerAddressRepository implements CustomerAddressRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(customerId: string): Promise<CustomerAddress[]> {
    const records = await this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map(mapAddress);
  }

  public async create(customerId: string, input: CreateCustomerAddressInput): Promise<CustomerAddress> {
    return this.prisma.$transaction(async (transaction) => {
      if (input.isDefault) {
        await transaction.customerAddress.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
      }
      const current = await transaction.customerAddress.count({ where: { customerId } });
      return mapAddress(await transaction.customerAddress.create({
        data: { ...input, customerId, isDefault: input.isDefault ?? current === 0 },
      }));
    });
  }

  public async update(id: string, customerId: string, input: UpdateCustomerAddressInput): Promise<CustomerAddress> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.customerAddress.findFirst({ where: { id, customerId } });
      if (!current) throw new CustomerNotFoundError();
      if (input.isDefault) {
        await transaction.customerAddress.updateMany({ where: { customerId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return mapAddress(await transaction.customerAddress.update({ where: { id }, data: input }));
    });
  }

  public async delete(id: string, customerId: string): Promise<void> {
    try {
      const address = await this.prisma.customerAddress.findFirst({ where: { id, customerId }, select: { id: true } });
      if (!address) throw new CustomerNotFoundError();
      await this.prisma.customerAddress.delete({ where: { id: address.id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new CustomerNotFoundError();
      }
      throw error;
    }
  }
}

const mapAddress = (value: any): CustomerAddress => ({
  id: value.id,
  customerId: value.customerId,
  label: value.label,
  recipientName: value.recipientName,
  phone: value.phone,
  street: value.street,
  number: value.number,
  apartment: value.apartment,
  city: value.city,
  province: value.province,
  postalCode: value.postalCode,
  reference: value.reference,
  isDefault: value.isDefault,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});
