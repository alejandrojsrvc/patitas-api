import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';

export type OrderInventoryTransaction = Pick<
  PrismaService,
  'inventoryItem' | 'inventoryMovement' | 'couponRedemption' | 'coupon' | 'promotion' | 'orderBenefit'
>;

export const releaseFirstShippingClaim = async (transaction: OrderInventoryTransaction, orderId: string) => {
  if (!transaction.orderBenefit) return;
  await transaction.orderBenefit.updateMany({
    where: {
      orderId,
      origin: 'FIRST_ORDER_FREE_SHIPPING',
      claimKey: { not: null },
    },
    data: { claimKey: null },
  });
};

export const releaseOrderReservation = async (
  transaction: OrderInventoryTransaction,
  lines: Array<{ variantId: string; quantity: number }>,
  orderId: string,
  reason = 'Cancelación de pedido',
) => {
  for (const line of lines) {
    const inventory = await transaction.inventoryItem.findUnique({
      where: { variantId: line.variantId },
    });
    const movements = await transaction.inventoryMovement.findMany({
      where: {
        orderId,
        variantId: line.variantId,
        type: { in: ['RESERVE', 'RELEASE'] },
      },
      select: { type: true, quantity: true },
    });
    const reserved = movements.filter((movement) => movement.type === 'RESERVE').reduce((sum, movement) => sum + movement.quantity, 0);
    const released = movements.filter((movement) => movement.type === 'RELEASE').reduce((sum, movement) => sum + movement.quantity, 0);
    const quantity = Math.min(line.quantity, Math.max(0, reserved - released), inventory?.reserved ?? 0);
    if (!quantity) continue;
    await transaction.inventoryItem.update({
      where: { variantId: line.variantId },
      data: { reserved: { decrement: quantity } },
    });
    await transaction.inventoryMovement.create({
      data: {
        id: randomUUID(),
        variantId: line.variantId,
        orderId,
        type: 'RELEASE',
        quantity,
        reason,
      },
    });
  }
};

export const reverseCouponRedemptions = async (transaction: OrderInventoryTransaction, orderId: string) => {
  const redemptions = await transaction.couponRedemption.findMany({
    where: { orderId },
    select: { id: true, couponId: true },
  });
  for (const redemption of redemptions) {
    await transaction.couponRedemption.delete({
      where: { id: redemption.id },
    });
    await transaction.coupon.update({
      where: { id: redemption.couponId },
      data: { redemptionCount: { decrement: 1 } },
    });
    const coupon = await transaction.coupon.findUniqueOrThrow({
      where: { id: redemption.couponId },
      select: { promotionId: true },
    });
    await transaction.promotion.update({
      where: { id: coupon.promotionId },
      data: { redemptionCount: { decrement: 1 } },
    });
  }
};
