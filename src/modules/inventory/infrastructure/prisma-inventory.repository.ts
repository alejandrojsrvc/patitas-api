import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { InventoryValidationError } from '../application/inventory.service';
import type { InventoryRepository } from '../domain/inventory.repository';
import type {
  InventoryAdjustment,
  InventoryListFilter,
  InventoryPage,
  InventoryRow,
} from '../domain/inventory.types';

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(filter: InventoryListFilter): Promise<InventoryPage> {
    const q = filter.q?.trim();
    const where: Prisma.ProductVariantWhereInput = q
      ? {
          OR: [
            { sku: { contains: q, mode: 'insensitive' } },
            { presentation: { contains: q, mode: 'insensitive' } },
            { product: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        include: { product: true, inventory: true },
        orderBy: [{ product: { name: 'asc' } }, { presentation: 'asc' }],
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.prisma.productVariant.count({ where }),
    ]);
    return {
      items: rows.map(mapRow),
      page: filter.page,
      perPage: filter.perPage,
      total,
    };
  }

  public async adjust(
    input: InventoryAdjustment,
    actorUserId?: string,
  ): Promise<InventoryRow> {
    return this.prisma.$transaction(
      async (transaction) => {
        const locked = await transaction.$queryRaw<
          Array<{
            id: string;
            variant_id: string;
            on_hand: number;
            reserved: number;
          }>
        >(
          Prisma.sql`SELECT id, variant_id, on_hand, reserved FROM inventory_items WHERE variant_id = ${input.variantId} FOR UPDATE`,
        );
        const current = locked[0];
        if (!current)
          throw new InventoryValidationError(
            'La variante no tiene registro de inventario.',
          );
        const onHand = Number(current.on_hand) + input.quantityDelta;
        const reserved = Number(current.reserved);
        if (onHand < 0 || onHand < reserved)
          throw new InventoryValidationError(
            'El ajuste dejaría el inventario por debajo de las reservas.',
          );
        const updated = await transaction.inventoryItem.update({
          where: { variantId: input.variantId },
          data: { onHand },
          include: { variant: { include: { product: true } } },
        });
        await transaction.$executeRaw(
          Prisma.sql`INSERT INTO inventory_movements (variant_id, type, quantity, reason, actor_user_id) VALUES (${input.variantId}, 'ADJUSTMENT'::"InventoryMovementType", ${input.quantityDelta}, ${input.reason}, ${actorUserId ?? null})`,
        );
        return mapRow({
          ...updated,
          variant: updated.variant,
          onHand: updated.onHand,
          reserved: updated.reserved,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}

interface InventorySource {
  id?: string;
  variantId?: string;
  productId?: string;
  sku?: string | null;
  presentation?: string | null;
  onHand?: number;
  reserved?: number;
  product?: { name: string };
  variant?: {
    productId: string;
    sku: string | null;
    presentation: string | null;
    product: { name: string };
  };
  inventory?: { onHand: number; reserved: number } | null;
}

const mapRow = (value: InventorySource): InventoryRow => {
  const onHand = value.onHand ?? value.inventory?.onHand ?? 0;
  const reserved = value.reserved ?? value.inventory?.reserved ?? 0;
  return {
    variantId: value.variantId ?? value.id ?? '',
    productId: value.variant?.productId ?? value.productId ?? '',
    productName: value.variant?.product.name ?? value.product?.name ?? '',
    sku: value.variant?.sku ?? value.sku ?? null,
    presentation: value.variant?.presentation ?? value.presentation ?? null,
    onHand,
    reserved,
    available: Math.max(0, onHand - reserved),
  };
};
