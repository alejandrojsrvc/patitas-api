import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  SupplierConflictError,
  SupplierNotFoundError,
  SupplierValidationError,
} from '../../application/supplier.service';
import type { SupplierRepository } from '../../domain/repositories/supplier.repository';
import type {
  CreateSupplierInput,
  CreateSupplierOfferInput,
  Supplier,
  SupplierFilter,
  SupplierOffer,
  SupplierPage,
  UpdateSupplierInput,
  UpdateSupplierOfferInput,
} from '../../domain/supplier.types';

interface PersistenceOffer {
  id: string;
  supplierId: string;
  variantId: string;
  supplierSku: string | null;
  unitCost: { toString(): string };
  currency: string;
  stockStatus: string;
  leadTimeHours: number | null;
  minimumQuantity: number;
  active: boolean;
  revision: number;
  updatedAt: Date;
}

@Injectable()
export class PrismaSupplierRepository implements SupplierRepository {
  public constructor(private readonly prisma: PrismaService) {}
  public async listSuppliers(filter: SupplierFilter): Promise<SupplierPage> {
    const where: Prisma.SupplierWhereInput = {
      ...(filter.active === undefined ? {} : { active: filter.active }),
      ...(filter.q
        ? { name: { contains: filter.q, mode: 'insensitive' } }
        : {}),
    };
    const [suppliers, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return {
      items: suppliers.map(mapSupplier),
      page: filter.page,
      perPage: filter.perPage,
      total,
    };
  }
  public async findSupplier(id: string): Promise<Supplier | null> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    return supplier ? mapSupplier(supplier) : null;
  }
  public createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    return this.write(async () =>
      mapSupplier(await this.prisma.supplier.create({ data: input })),
    );
  }
  public updateSupplier(
    id: string,
    input: UpdateSupplierInput,
  ): Promise<Supplier> {
    return this.write(async () =>
      mapSupplier(
        await this.prisma.supplier.update({ where: { id }, data: input }),
      ),
    );
  }
  public async listOffers(filter: {
    supplierId?: string;
    variantId?: string;
    active?: boolean;
  }): Promise<SupplierOffer[]> {
    const offers = await this.prisma.supplierOffer.findMany({
      where: filter,
      orderBy: { updatedAt: 'desc' },
    });
    return offers.map(mapOffer);
  }
  public async findOffer(id: string): Promise<SupplierOffer | null> {
    const offer = await this.prisma.supplierOffer.findUnique({ where: { id } });
    return offer ? mapOffer(offer) : null;
  }
  public async createOffer(
    input: CreateSupplierOfferInput,
  ): Promise<SupplierOffer> {
    return this.write(async () =>
      mapOffer(
        await this.prisma.supplierOffer.create({
          data: { ...input, currency: 'ARS' },
        }),
      ),
    );
  }
  public async updateOffer(
    id: string,
    input: UpdateSupplierOfferInput,
  ): Promise<SupplierOffer> {
    return this.write(async () =>
      mapOffer(
        await this.prisma.supplierOffer.update({
          where: { id },
          data: { ...input, revision: { increment: 1 } },
        }),
      ),
    );
  }

  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new SupplierConflictError(
            'Ya existe una oferta para ese proveedor y variante.',
          );
        }
        if (error.code === 'P2025') {
          throw new SupplierNotFoundError('El registro no existe.');
        }
        if (error.code === 'P2003') {
          throw new SupplierValidationError(
            'El proveedor o la variante no existe.',
          );
        }
      }
      throw error;
    }
  }
}

const mapSupplier = (supplier: {
  id: string;
  name: string;
  active: boolean;
}): Supplier => ({
  id: supplier.id,
  name: supplier.name,
  active: supplier.active,
});

const mapOffer = (offer: PersistenceOffer): SupplierOffer => ({
  id: offer.id,
  supplierId: offer.supplierId,
  variantId: offer.variantId,
  supplierSku: offer.supplierSku,
  unitCost: offer.unitCost.toString(),
  currency: 'ARS',
  stockStatus: offer.stockStatus as SupplierOffer['stockStatus'],
  leadTimeHours: offer.leadTimeHours,
  minimumQuantity: offer.minimumQuantity,
  active: offer.active,
  revision: offer.revision,
  updatedAt: offer.updatedAt,
});
