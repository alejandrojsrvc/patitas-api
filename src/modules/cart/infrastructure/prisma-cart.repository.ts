import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CartRepository } from '../domain/cart.repository';
import type { Cart, CartItem, CartOwner, CartPage } from '../domain/cart.types';
import { CartValidationError } from '../domain/cart.error';

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      variant: {
        include: {
          product: { include: { media: { orderBy: { displayOrder: 'asc' as const } } } },
          inventory: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class PrismaCartRepository implements CartRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async findActive(owner: CartOwner): Promise<Cart | null> {
    await this.markAbandoned();
    const record = await this.prisma.cart.findFirst({
      where: { status: 'ACTIVE', ...(owner.customerId ? { customerId: owner.customerId } : { anonymousTokenHash: owner.tokenHash }) },
      include: cartInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return record ? mapCart(record) : null;
  }

  public async create(owner: CartOwner): Promise<Cart> {
    const record = await this.prisma.cart.create({ data: { customerId: owner.customerId ?? null, anonymousTokenHash: owner.tokenHash ?? null, items: { create: [] } }, include: cartInclude });
    return mapCart(record);
  }

  public async setItem(owner: CartOwner, variantId: string, quantity: number): Promise<Cart> {
    return this.prisma.$transaction(async (transaction) => {
      const cart = await findOrCreateTransactionCart(transaction, owner);
      const variant = await transaction.productVariant.findUnique({ where: { id: variantId }, include: { product: true, inventory: true } });
      if (!variant || !variant.active || variant.product.status !== 'ACTIVE' || !variant.salePrice || Number(variant.salePrice) <= 0) {
        throw new CartValidationError('La variante no está disponible para la venta.');
      }
      await transaction.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId } }, create: { cartId: cart.id, variantId, quantity }, update: { quantity } });
      await transaction.cart.update({ where: { id: cart.id }, data: { status: 'ACTIVE', lastActivityAt: new Date(), abandonedAt: null } });
      return mapCart(await transaction.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude }));
    });
  }

  public async removeItem(owner: CartOwner, variantId: string): Promise<Cart> {
    return this.prisma.$transaction(async (transaction) => {
      const cart = await findOrCreateTransactionCart(transaction, owner);
      await transaction.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
      await transaction.cart.update({ where: { id: cart.id }, data: { lastActivityAt: new Date() } });
      return mapCart(await transaction.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude }));
    });
  }

  public async merge(tokenHash: string, customerId: string): Promise<Cart> {
    return this.prisma.$transaction(async (transaction) => {
      const guest = await transaction.cart.findFirst({ where: { anonymousTokenHash: tokenHash, status: { in: ['ACTIVE', 'ABANDONED'] } }, include: { items: true } });
      if (!guest) {
        const existing = await transaction.cart.findFirst({ where: { customerId, status: 'ACTIVE' }, include: cartInclude });
        return existing ? mapCart(existing) : mapCart(await transaction.cart.create({ data: { customerId }, include: cartInclude }));
      }
      const customerCart = await transaction.cart.findFirst({ where: { customerId, status: 'ACTIVE' }, include: { items: true } });
      const target = customerCart ?? await transaction.cart.create({ data: { customerId, status: 'ACTIVE' }, include: { items: true } });
      for (const item of guest.items) {
        const existing = target.items.find((candidate) => candidate.variantId === item.variantId);
        if (existing) await transaction.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(99, existing.quantity + item.quantity) } });
        else await transaction.cartItem.create({ data: { cartId: target.id, variantId: item.variantId, quantity: item.quantity } });
      }
      await transaction.cart.update({ where: { id: target.id }, data: { lastActivityAt: new Date() } });
      await transaction.cart.update({ where: { id: guest.id }, data: { status: 'CONVERTED', anonymousTokenHash: null, convertedOrderId: null } });
      return mapCart(await transaction.cart.findUniqueOrThrow({ where: { id: target.id }, include: cartInclude }));
    });
  }

  public async listAbandoned(page: number, perPage: number): Promise<CartPage> {
    await this.markAbandoned();
    const where = { status: 'ABANDONED' as const };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cart.findMany({ where, include: cartInclude, orderBy: { abandonedAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
      this.prisma.cart.count({ where }),
    ]);
    return { items: items.map(mapCart), page, perPage, total };
  }

  private async markAbandoned() {
    await this.prisma.cart.updateMany({ where: { status: 'ABANDONED', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.cart.updateMany({ where: { status: 'ACTIVE', lastActivityAt: { lt: threshold }, items: { some: {} } }, data: { status: 'ABANDONED', abandonedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  }
}

const findOrCreateTransactionCart = async (transaction: any, owner: CartOwner) => {
  const current = await transaction.cart.findFirst({ where: { status: { in: ['ACTIVE', 'ABANDONED'] }, ...(owner.customerId ? { customerId: owner.customerId } : { anonymousTokenHash: owner.tokenHash }) }, include: { items: true } });
  if (current) return current;
  return transaction.cart.create({ data: { customerId: owner.customerId ?? null, anonymousTokenHash: owner.tokenHash ?? null }, include: { items: true } });
};

const mapCart = (value: any): Cart => {
  const items = (value.items ?? []).map((item: any): CartItem => {
    const unitPrice = Number(item.variant.salePrice ?? 0);
    return {
      id: item.id,
      variantId: item.variantId,
      productId: item.variant.productId,
      productName: item.variant.product.name,
      slug: item.variant.product.slug,
      sku: item.variant.sku,
      presentation: item.variant.presentation,
      imageUrl: item.variant.product.media?.[0]?.url ?? null,
      unitPrice: unitPrice.toFixed(2),
      quantity: item.quantity,
      lineTotal: (unitPrice * item.quantity).toFixed(2),
      availableQuantity: Math.max(0, (item.variant.inventory?.onHand ?? 0) - (item.variant.inventory?.reserved ?? 0)),
    };
  });
  return {
    id: value.id,
    customerId: value.customerId,
    status: value.status,
    currency: 'ARS',
    subtotal: items.reduce((sum: number, item: CartItem) => sum + Number(item.lineTotal), 0).toFixed(2),
    lastActivityAt: value.lastActivityAt,
    items,
  };
};
