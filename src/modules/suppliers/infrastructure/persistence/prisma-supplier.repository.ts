import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  SupplierConflictError,
  SupplierNotFoundError,
  SupplierValidationError,
} from '../../application/supplier.service';
import type {
  SupplierOfferImportOptions,
  SupplierRepository,
} from '../../domain/repositories/supplier.repository';
import type {
  CreateSupplierInput,
  CreateSupplierOfferInput,
  Supplier,
  SupplierFilter,
  SupplierOffer,
  SupplierOfferImportError,
  SupplierOfferImportResult,
  SupplierOfferImportRow,
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
  fulfillmentMode: string;
  supplierCutoff: string | null;
  supplierToDepotMinutes: number | null;
  fulfillmentCost: { toString(): string };
  minimumQuantity: number;
  active: boolean;
  revision: number;
  updatedAt: Date;
}

interface PersistenceExportOffer extends PersistenceOffer {
  supplier: { name: string };
  variant: { sku: string | null; product: { name: string } };
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
  public async listAllSuppliers(): Promise<Supplier[]> {
    const suppliers = await this.prisma.supplier.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return suppliers.map(mapSupplier);
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
      orderBy: [{ unitCost: 'asc' }, { updatedAt: 'desc' }],
    });
    return offers.map(mapOffer);
  }
  public async listAllOffers(): Promise<
    Array<
      SupplierOffer & {
        supplierName: string;
        productName: string;
        sku: string | null;
      }
    >
  > {
    const offers = await this.prisma.supplierOffer.findMany({
      include: {
        supplier: true,
        variant: { select: { sku: true, product: { select: { name: true } } } },
      },
      orderBy: [
        { supplier: { name: 'asc' } },
        { updatedAt: 'desc' },
        { id: 'asc' },
      ],
    });
    return offers.map((offer: PersistenceExportOffer) => ({
      ...mapOffer(offer),
      supplierName: offer.supplier.name,
      productName: offer.variant.product.name,
      sku: offer.variant.sku,
    }));
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

  public async importOffers(
    rows: SupplierOfferImportRow[],
    options: SupplierOfferImportOptions,
  ): Promise<SupplierOfferImportResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const suppliers = await transaction.supplier.findMany({
          select: { id: true, name: true },
        });
        const pendingSuppliers: Array<{ id: string; name: string }> = [];
        if (!options.dryRun && options.createMissingSuppliers) {
          const names = new Map<string, string>();
          for (const row of rows) {
            if (row.supplierName && !row.supplierId) {
              names.set(normalizeReference(row.supplierName), row.supplierName);
            }
          }
          for (const [key, name] of names) {
            if (
              suppliers.some(
                (supplier) => normalizeReference(supplier.name) === key,
              )
            )
              continue;
            const pending = { id: randomUUID(), name };
            suppliers.push(pending);
            pendingSuppliers.push(pending);
          }
        }
        const supplierById = new Map(
          suppliers.map((supplier) => [supplier.id, supplier]),
        );
        const suppliersByName = new Map<string, typeof suppliers>();
        for (const supplier of suppliers) {
          const key = normalizeReference(supplier.name);
          const matches = suppliersByName.get(key) ?? [];
          matches.push(supplier);
          suppliersByName.set(key, matches);
        }

        const variantFilters: Prisma.ProductVariantWhereInput[] = [];
        const variantIds = rows
          .map((row) => row.variantId)
          .filter((value): value is string => value !== null);
        const skus = rows
          .map((row) => row.sku)
          .filter((value): value is string => value !== null);
        const barcodes = rows
          .map((row) => row.barcode)
          .filter((value): value is string => value !== null);
        if (variantIds.length) variantFilters.push({ id: { in: variantIds } });
        if (skus.length) variantFilters.push({ sku: { in: skus } });
        if (barcodes.length) variantFilters.push({ barcode: { in: barcodes } });
        const variants = variantFilters.length
          ? await transaction.productVariant.findMany({
              where: { OR: variantFilters },
              select: { id: true, sku: true, barcode: true },
            })
          : [];
        const variantById = new Map(
          variants.map((variant) => [variant.id, variant]),
        );
        const variantBySku = new Map(
          variants
            .filter((variant) => variant.sku)
            .map((variant) => [variant.sku!, variant]),
        );
        const variantByBarcode = new Map(
          variants
            .filter((variant) => variant.barcode)
            .map((variant) => [variant.barcode!, variant]),
        );
        const errors: SupplierOfferImportError[] = [];
        const resolved: Array<{
          row: SupplierOfferImportRow;
          supplierId: string;
          variantId: string;
        }> = [];
        const seenKeys = new Set<string>();

        for (const row of rows) {
          const supplier = resolveSupplier(row, supplierById, suppliersByName);
          if (!supplier) {
            errors.push({
              row: row.rowNumber,
              message: 'No se encontró un proveedor único para la fila.',
            });
            continue;
          }
          const variantIdsForRow = new Set<string>();
          if (row.variantId && variantById.has(row.variantId))
            variantIdsForRow.add(row.variantId);
          if (row.sku && variantBySku.has(row.sku))
            variantIdsForRow.add(variantBySku.get(row.sku)!.id);
          if (row.barcode && variantByBarcode.has(row.barcode))
            variantIdsForRow.add(variantByBarcode.get(row.barcode)!.id);
          if (variantIdsForRow.size === 0) {
            errors.push({
              row: row.rowNumber,
              message: 'No se encontró la variante por ID, SKU o barcode.',
            });
            continue;
          }
          if (variantIdsForRow.size > 1) {
            errors.push({
              row: row.rowNumber,
              message:
                'El ID, SKU y barcode de la fila apuntan a variantes distintas.',
            });
            continue;
          }
          const variantId = [...variantIdsForRow][0];
          const key = `${supplier.id}:${variantId}`;
          if (seenKeys.has(key)) {
            errors.push({
              row: row.rowNumber,
              message: 'El proveedor y la variante están repetidos en el CSV.',
            });
            continue;
          }
          seenKeys.add(key);
          resolved.push({ row, supplierId: supplier.id, variantId });
        }

        if (errors.length)
          return {
            total: rows.length,
            created: 0,
            updated: 0,
            errors,
            dryRun: options.dryRun,
          };

        for (const supplier of pendingSuppliers) {
          await transaction.supplier.create({
            data: { ...supplier, active: true },
          });
        }

        const existing = resolved.length
          ? await transaction.supplierOffer.findMany({
              where: {
                OR: resolved.map(({ supplierId, variantId }) => ({
                  supplierId,
                  variantId,
                })),
              },
              select: { supplierId: true, variantId: true },
            })
          : [];
        const existingKeys = new Set(
          existing.map((offer) => `${offer.supplierId}:${offer.variantId}`),
        );
        const created = resolved.filter(
          ({ supplierId, variantId }) =>
            !existingKeys.has(`${supplierId}:${variantId}`),
        ).length;
        const updated = resolved.length - created;
        if (options.dryRun)
          return { total: rows.length, created, updated, errors, dryRun: true };

        for (const { row, supplierId, variantId } of resolved) {
          await transaction.supplierOffer.upsert({
            where: {
              supplierId_variantId: { supplierId, variantId },
            },
            create: {
              id: randomUUID(),
              supplierId,
              variantId,
              supplierSku: row.supplierSku,
              unitCost: row.unitCost,
              currency: 'ARS',
              stockStatus: row.stockStatus,
              leadTimeHours: row.leadTimeHours,
              minimumQuantity: row.minimumQuantity,
              active: row.active,
            },
            update: {
              supplierSku: row.supplierSku,
              unitCost: row.unitCost,
              stockStatus: row.stockStatus,
              leadTimeHours: row.leadTimeHours,
              minimumQuantity: row.minimumQuantity,
              active: row.active,
              revision: { increment: 1 },
            },
          });
        }
        return { total: rows.length, created, updated, errors, dryRun: false };
      },
      { timeout: 30_000 },
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

const normalizeReference = (value: string): string =>
  value.trim().toLocaleLowerCase('es');

const resolveSupplier = (
  row: SupplierOfferImportRow,
  byId: Map<string, { id: string; name: string }>,
  byName: Map<string, Array<{ id: string; name: string }>>,
) => {
  if (row.supplierId) return byId.get(row.supplierId) ?? null;
  const matches = row.supplierName
    ? (byName.get(normalizeReference(row.supplierName)) ?? [])
    : [];
  return matches.length === 1 ? matches[0] : null;
};

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
  fulfillmentMode: offer.fulfillmentMode as SupplierOffer['fulfillmentMode'],
  supplierCutoff: offer.supplierCutoff,
  supplierToDepotMinutes: offer.supplierToDepotMinutes,
  fulfillmentCost: offer.fulfillmentCost.toString(),
  minimumQuantity: offer.minimumQuantity,
  active: offer.active,
  revision: offer.revision,
  updatedAt: offer.updatedAt,
});
