import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CartRepository } from '../domain/cart.repository';
import type {
  Cart,
  CartItem,
  CartItemContext,
  CartOwner,
  CartPage,
  CartSummary,
} from '../domain/cart.types';
import { CartValidationError } from '../domain/cart.error';

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      variant: {
        include: {
          product: {
            include: { media: { orderBy: { displayOrder: 'asc' as const } } },
          },
          inventory: true,
        },
      },
    },
  },
} as const;
type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type CartTransaction = Pick<
  PrismaService,
  'cart' | 'cartItem' | 'productVariant' | 'pet' | 'replenishmentPlan'
>;

@Injectable()
export class PrismaCartRepository implements CartRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async findActive(owner: CartOwner): Promise<Cart | null> {
    const record = await this.prisma.cart.findFirst({
      where: {
        status: 'ACTIVE',
        lastActivityAt: { gte: activeCartThreshold() },
        ...(owner.customerId
          ? { customerId: owner.customerId }
          : { anonymousTokenHash: owner.tokenHash }),
        source: owner.source ?? 'STORE',
      },
      include: cartInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return record ? mapCart(record) : null;
  }

  public async findActiveSummary(
    owner: CartOwner,
  ): Promise<CartSummary | null> {
    const record = await this.prisma.cart.findFirst({
      where: {
        status: 'ACTIVE',
        lastActivityAt: { gte: activeCartThreshold() },
        ...(owner.customerId
          ? { customerId: owner.customerId }
          : { anonymousTokenHash: owner.tokenHash }),
        source: owner.source ?? 'STORE',
      },
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            variant: { select: { salePrice: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!record) return null;
    return {
      id: record.id,
      itemCount: record.items.reduce((total, item) => total + item.quantity, 0),
      subtotal: record.items
        .reduce(
          (total, item) =>
            total + Number(item.variant.salePrice ?? 0) * item.quantity,
          0,
        )
        .toFixed(2),
      currency: 'ARS',
    };
  }

  public async create(owner: CartOwner): Promise<Cart> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const record = await this.prisma.cart.create({
          data: {
            customerId: owner.customerId ?? null,
            anonymousTokenHash: owner.tokenHash ?? null,
            source: owner.source ?? 'STORE',
            items: { create: [] },
          },
          include: cartInclude,
        });
        return mapCart(record);
      } catch (error) {
        if (!isUniqueConstraintError(error) || !owner.tokenHash) throw error;
        const existing = await this.prisma.cart.findFirst({
          where: {
            anonymousTokenHash: owner.tokenHash,
            source: owner.source ?? 'STORE',
          },
          include: cartInclude,
          orderBy: { updatedAt: 'desc' },
        });
        if (existing?.status === 'ACTIVE' || existing?.status === 'ABANDONED')
          return mapCart(existing);
        await this.prisma.cart.updateMany({
          where: { anonymousTokenHash: owner.tokenHash },
          data: { anonymousTokenHash: null },
        });
      }
    }
    throw new CartValidationError('No se pudo crear el carrito.');
  }

  public async setItem(
    owner: CartOwner,
    variantId: string,
    quantity: number,
    context?: CartItemContext,
  ): Promise<Cart> {
    return this.prisma.$transaction(async (transaction) => {
      const cart = await findOrCreateTransactionCart(transaction, owner);
      const variant = await transaction.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true, inventory: true },
      });
      if (
        !variant ||
        !variant.active ||
        variant.product.status !== 'ACTIVE' ||
        !variant.salePrice ||
        Number(variant.salePrice) <= 0
      ) {
        throw new CartValidationError(
          'La variante no está disponible para la venta.',
        );
      }
      await validateContext(transaction, owner, context);
      await transaction.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        create: {
          cartId: cart.id,
          variantId,
          quantity,
          ...(context ?? { role: 'EXTRA', petId: null, planId: null }),
        },
        update: { quantity, ...(context ?? {}) },
      });
      await transaction.cart.update({
        where: { id: cart.id },
        data: {
          status: 'ACTIVE',
          lastActivityAt: new Date(),
          abandonedAt: null,
        },
      });
      return mapCart(
        await transaction.cart.findUniqueOrThrow({
          where: { id: cart.id },
          include: cartInclude,
        }),
      );
    });
  }

  public async reorderItem(
    owner: CartOwner,
    variantId: string,
    quantity: number,
    context: CartItemContext,
  ): Promise<Cart> {
    return this.prisma.$transaction(async (transaction) => {
      const cart = await findOrCreateTransactionCart(transaction, owner);
      const variant = await transaction.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true, inventory: true },
      });
      if (
        !variant ||
        !variant.active ||
        variant.product.status !== 'ACTIVE' ||
        !variant.salePrice ||
        Number(variant.salePrice) <= 0
      )
        throw new CartValidationError(
          'La variante no está disponible para la venta.',
        );
      await validateContext(transaction, owner, context);
      const existing = await transaction.cartItem.findUnique({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
      });
      if (existing)
        await transaction.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: Math.min(99, existing.quantity + quantity),
            role: 'MAIN',
            petId: context.petId ?? null,
            planId: context.planId ?? null,
          },
        });
      else
        await transaction.cartItem.create({
          data: {
            cartId: cart.id,
            variantId,
            quantity,
            role: 'MAIN',
            petId: context.petId ?? null,
            planId: context.planId ?? null,
          },
        });
      await transaction.cart.update({
        where: { id: cart.id },
        data: {
          status: 'ACTIVE',
          lastActivityAt: new Date(),
          abandonedAt: null,
        },
      });
      return mapCart(
        await transaction.cart.findUniqueOrThrow({
          where: { id: cart.id },
          include: cartInclude,
        }),
      );
    });
  }

  public async removeItem(owner: CartOwner, variantId: string): Promise<Cart> {
    return this.prisma.$transaction(async (transaction) => {
      const cart = await findOrCreateTransactionCart(transaction, owner);
      await transaction.cartItem.deleteMany({
        where: { cartId: cart.id, variantId },
      });
      await transaction.cart.update({
        where: { id: cart.id },
        data: { lastActivityAt: new Date() },
      });
      return mapCart(
        await transaction.cart.findUniqueOrThrow({
          where: { id: cart.id },
          include: cartInclude,
        }),
      );
    });
  }

  public async merge(
    tokenHash: string,
    customerId: string,
    source: CartOwner['source'] = 'STORE',
  ): Promise<Cart> {
    return this.prisma.$transaction(async (transaction) => {
      const guest = await transaction.cart.findFirst({
        where: {
          anonymousTokenHash: tokenHash,
          source: source ?? 'STORE',
          status: { in: ['ACTIVE', 'ABANDONED'] },
        },
        include: { items: true },
      });
      if (!guest) {
        const existing = await transaction.cart.findFirst({
          where: { customerId, status: 'ACTIVE', source: source ?? 'STORE' },
          include: cartInclude,
        });
        return existing
          ? mapCart(existing)
          : mapCart(
              await transaction.cart.create({
                data: { customerId, source: source ?? 'STORE' },
                include: cartInclude,
              }),
            );
      }
      const customerCart = await transaction.cart.findFirst({
        where: { customerId, status: 'ACTIVE', source: source ?? 'STORE' },
        include: { items: true },
      });
      const target =
        customerCart ??
        (await transaction.cart.create({
          data: { customerId, status: 'ACTIVE', source: source ?? 'STORE' },
          include: { items: true },
        }));
      for (const item of guest.items) {
        const existing = target.items.find(
          (candidate) => candidate.variantId === item.variantId,
        );
        if (existing)
          await transaction.cartItem.update({
            where: { id: existing.id },
            data: {
              quantity: Math.min(99, existing.quantity + item.quantity),
              ...(item.role === 'MAIN' && existing.role !== 'MAIN'
                ? {
                    role: item.role,
                    petId: item.petId,
                    planId: item.planId,
                  }
                : {}),
            },
          });
        else
          await transaction.cartItem.create({
            data: {
              cartId: target.id,
              variantId: item.variantId,
              quantity: item.quantity,
              role: item.role,
              petId: item.petId,
              planId: item.planId,
            },
          });
      }
      await transaction.cart.update({
        where: { id: target.id },
        data: { lastActivityAt: new Date() },
      });
      await transaction.cart.update({
        where: { id: guest.id },
        data: {
          status: 'CONVERTED',
          anonymousTokenHash: null,
          convertedOrderId: null,
        },
      });
      return mapCart(
        await transaction.cart.findUniqueOrThrow({
          where: { id: target.id },
          include: cartInclude,
        }),
      );
    });
  }

  public async listAbandoned(page: number, perPage: number): Promise<CartPage> {
    await this.markAbandoned();
    const where = { status: 'ABANDONED' as const };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cart.findMany({
        where,
        include: cartInclude,
        orderBy: { abandonedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.cart.count({ where }),
    ]);
    return { items: items.map(mapCart), page, perPage, total };
  }

  private async markAbandoned() {
    await this.prisma.cart.updateMany({
      where: { status: 'ABANDONED', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.cart.updateMany({
      where: {
        status: 'ACTIVE',
        lastActivityAt: { lt: threshold },
        items: { some: {} },
      },
      data: {
        status: 'ABANDONED',
        abandonedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
}

const findOrCreateTransactionCart = async (
  transaction: CartTransaction,
  owner: CartOwner,
) => {
  const current = await transaction.cart.findFirst({
    where: {
      status: { in: ['ACTIVE', 'ABANDONED'] },
      ...(owner.customerId
        ? { customerId: owner.customerId }
        : { anonymousTokenHash: owner.tokenHash }),
      source: owner.source ?? 'STORE',
    },
    include: { items: true },
  });
  if (current) return current;
  try {
    return await transaction.cart.create({
      data: {
        customerId: owner.customerId ?? null,
        anonymousTokenHash: owner.tokenHash ?? null,
        source: owner.source ?? 'STORE',
      },
      include: { items: true },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error) || !owner.tokenHash) throw error;
    const existing = await transaction.cart.findFirst({
      where: {
        anonymousTokenHash: owner.tokenHash,
        source: owner.source ?? 'STORE',
      },
      include: { items: true },
    });
    if (existing) return existing;
    throw error;
  }
};

const activeCartThreshold = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

const validateContext = async (
  transaction: CartTransaction,
  owner: CartOwner,
  context?: CartItemContext,
): Promise<void> => {
  if (!context) return;
  if (context.role === 'MAIN' && !context.petId)
    throw new CartValidationError(
      'Una línea principal debe estar asociada a una mascota.',
    );
  if ((context.petId || context.planId) && !owner.customerId)
    throw new CartValidationError(
      'El contexto de la línea requiere una sesión de cliente.',
    );
  if (context.petId) {
    const pet = await transaction.pet.findFirst({
      where: { id: context.petId, customerId: owner.customerId! },
      select: { id: true },
    });
    if (!pet)
      throw new CartValidationError('La mascota no existe o no tienes acceso.');
  }
  if (context.planId) {
    const plan = await transaction.replenishmentPlan.findFirst({
      where: { id: context.planId, customerId: owner.customerId! },
      select: { id: true, petId: true },
    });
    if (!plan || (context.petId && plan.petId !== context.petId))
      throw new CartValidationError('El plan no existe o no tienes acceso.');
  }
};

const mapCart = (value: CartRecord): Cart => {
  const items = value.items.map((item): CartItem => {
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
      availableQuantity: Math.max(
        0,
        (item.variant.inventory?.onHand ?? 0) -
          (item.variant.inventory?.reserved ?? 0),
      ),
      role: item.role === 'MAIN' ? 'MAIN' : 'EXTRA',
      petId: item.petId,
      planId: item.planId,
    };
  });
  return {
    id: value.id,
    customerId: value.customerId,
    status: value.status,
    currency: 'ARS',
    subtotal: items
      .reduce((sum: number, item: CartItem) => sum + Number(item.lineTotal), 0)
      .toFixed(2),
    lastActivityAt: value.lastActivityAt,
    items,
    source: value.source === 'MOBILE' ? 'MOBILE' : 'STORE',
  };
};
