import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CustomerNotFoundError,
  CustomerValidationError,
} from '../domain/customer.error';
import type { CustomerRepository } from '../domain/customer.repository';
import type {
  CreateCustomerInput,
  Customer,
  CustomerFilter,
  CustomerPage,
  UpdateCustomerInput,
} from '../domain/customer.types';

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(filter: CustomerFilter): Promise<CustomerPage> {
    const where: Prisma.CustomerWhereInput = {
      ...(filter.active === undefined ? {} : { active: filter.active }),
      ...(filter.q
        ? {
            OR: [
              { fullName: { contains: filter.q, mode: 'insensitive' } },
              { email: { contains: filter.q, mode: 'insensitive' } },
              { phone: { contains: filter.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return {
      items: records.map(mapCustomer),
      page: filter.page,
      perPage: filter.perPage,
      total,
    };
  }

  public async findById(id: string): Promise<Customer | null> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    return customer ? mapCustomer(customer) : null;
  }

  public async findByUserId(userId: string): Promise<Customer | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    return customer ? mapCustomer(customer) : null;
  }

  public async create(input: CreateCustomerInput): Promise<Customer> {
    try {
      return mapCustomer(await this.prisma.customer.create({ data: input }));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new CustomerValidationError(
          'Ya existe un cliente asociado a ese usuario.',
        );
      }
      throw error;
    }
  }

  public async update(
    id: string,
    input: UpdateCustomerInput,
  ): Promise<Customer> {
    try {
      return mapCustomer(
        await this.prisma.customer.update({ where: { id }, data: input }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new CustomerNotFoundError();
      }
      throw error;
    }
  }
}

const mapCustomer = (value: {
  id: string;
  userId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Customer => ({ ...value });
