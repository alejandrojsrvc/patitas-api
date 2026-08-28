import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  createAnonymousToken,
  hashAnonymousToken,
} from '../../../shared/application/anonymous-token';
import { calculateDiscount } from '../../promotions/domain/promotion-calculator';
import { isWithinPeriod } from '../../promotions/application/promotion.service';
import {
  CheckoutConflictError,
  CheckoutNotFoundError,
  CheckoutValidationError,
} from '../domain/checkout.error';
import type { CheckoutRepository } from '../domain/checkout.repository';
import type {
  CheckoutOwner,
  CheckoutSession,
  OrderSummary,
} from '../domain/checkout.types';
import type { CartItem } from '../../cart/domain/cart.types';
import type {
  Coupon,
  Promotion,
  PromotionLine,
} from '../../promotions/domain/promotion.types';

const sessionInclude = {
  cart: {
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  media: { orderBy: { displayOrder: 'asc' as const } },
                  brand: true,
                  category: true,
                },
              },
              inventory: true,
            },
          },
        },
      },
    },
  },
  coupon: {
    include: { promotion: { include: { targets: true, bundleItems: true } } },
  },
  shippingOption: true,
} as const;
const orderInclude = {
  lines: true,
  replenishmentPlans: { select: { petName: true } },
} as const;
type SessionRecord = Prisma.CheckoutSessionGetPayload<{
  include: typeof sessionInclude;
}>;
type PromotionRecord = Prisma.PromotionGetPayload<{
  include: { targets: true; bundleItems: true };
}>;
type CouponRecord = Prisma.CouponGetPayload<{
  include: { promotion: { include: { targets: true; bundleItems: true } } };
}>;
type CheckoutItem = SessionRecord['cart']['items'][number];

@Injectable()
export class PrismaCheckoutRepository implements CheckoutRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(cartId: string, owner: CheckoutOwner) {
    if (!owner.customerId && !owner.tokenHash)
      throw new CheckoutValidationError('Se requiere la sesión del carrito.');
    const cart = await this.prisma.cart.findFirst({
      where: {
        id: cartId,
        status: { in: ['ACTIVE', 'ABANDONED'] },
        ...(owner.customerId
          ? { customerId: owner.customerId }
          : { anonymousTokenHash: owner.tokenHash }),
      },
      include: { items: true },
    });
    if (!cart || !cart.items.length)
      throw new CheckoutValidationError('El carrito no existe o está vacío.');
    const token = createAnonymousToken();
    const existing = await this.prisma.checkoutSession.findUnique({
      where: { cartId },
      include: sessionInclude,
    });
    if (existing) return this.resumeSession(existing, token);

    try {
      const session = await this.prisma.checkoutSession.create({
        data: {
          cartId,
          customerId: owner.customerId ?? null,
          accessTokenHash: hashAnonymousToken(token),
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
        include: sessionInclude,
      });
      return { session: await this.toSession(session), token };
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ))
        throw error;
      const concurrent = await this.prisma.checkoutSession.findUnique({
        where: { cartId },
        include: sessionInclude,
      });
      if (!concurrent) throw error;
      return this.resumeSession(concurrent, token);
    }
  }

  public async find(id: string, owner: CheckoutOwner) {
    return this.toSession(await this.authorizedSession(id, owner));
  }

  public async setContact(
    id: string,
    owner: CheckoutOwner,
    input: {
      contactName: string;
      contactEmail: string;
      contactPhone?: string | null;
    },
  ) {
    await this.authorizedSession(id, owner);
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: {
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone ?? null,
          stage: 'SHIPPING',
        },
        include: sessionInclude,
      }),
    );
  }
  public async setAddress(
    id: string,
    owner: CheckoutOwner,
    address: Record<string, string>,
  ) {
    await this.authorizedSession(id, owner);
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: {
          shippingAddress: address,
          stage: 'SHIPPING',
        },
        include: sessionInclude,
      }),
    );
  }
  public async setShippingOption(
    id: string,
    owner: CheckoutOwner,
    shippingOptionId: string,
  ) {
    const session = await this.authorizedSession(id, owner);
    const option = await this.prisma.shippingOption.findFirst({
      where: { id: shippingOptionId, active: true },
    });
    if (!option)
      throw new CheckoutValidationError(
        'La opción de envío no está disponible.',
      );
    const zones = await this.prisma.shippingZone.findMany({
      where: { active: true },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
    let shippingCost: string | number = option.cost.toString();
    let shippingZoneId: string | null = null;
    let shippingEstimate: string | null = null;
    if (zones.length) {
      const address = (session.shippingAddress ?? {}) as Record<string, string>;
      const postalCode = address.postalCode?.trim().toUpperCase();
      const neighborhood = address.neighborhood?.trim().toLowerCase();
      const weightGrams = session.cart.items.reduce(
        (sum: number, item: CheckoutItem) =>
          sum + Number(item.variant?.weightGrams ?? 0) * item.quantity,
        0,
      );
      const zone = zones.find(
        (candidate) =>
          (!candidate.maxWeightGrams ||
            !weightGrams ||
            weightGrams <= candidate.maxWeightGrams) &&
          ((postalCode &&
            candidate.postalCodes.some(
              (value: string) => value.toUpperCase() === postalCode,
            )) ||
            (neighborhood &&
              candidate.neighborhoods.some(
                (value: string) => value.toLowerCase() === neighborhood,
              ))),
      );
      if (!zone)
        throw new CheckoutValidationError(
          'La dirección está fuera de cobertura.',
        );
      shippingZoneId = zone.id;
      shippingCost =
        zone.freeShippingFrom !== null &&
        Number(
          session.cart.items.reduce(
            (sum: number, item: CheckoutItem) =>
              sum + Number(item.variant?.salePrice ?? 0) * item.quantity,
            0,
          ),
        ) >= Number(zone.freeShippingFrom)
          ? 0
          : Number(zone.cost);
      shippingEstimate = `${zone.estimatedDaysMin}-${zone.estimatedDaysMax} días hábiles`;
    }
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: {
          shippingOptionId,
          shippingCost,
          shippingZoneId,
          shippingEstimate,
          stage: 'PAYMENT',
        },
        include: sessionInclude,
      }),
    );
  }
  public async setPaymentMethod(
    id: string,
    owner: CheckoutOwner,
    paymentMethod: string,
  ) {
    await this.authorizedSession(id, owner);
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: { paymentMethod, stage: 'CONFIRMATION' },
        include: sessionInclude,
      }),
    );
  }
  public async applyCoupon(id: string, owner: CheckoutOwner, code: string) {
    const session = await this.authorizedSession(id, owner);
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { promotion: { include: { targets: true, bundleItems: true } } },
    });
    if (
      !coupon ||
      !coupon.active ||
      !isWithinPeriod(coupon.startsAt, coupon.endsAt) ||
      (coupon.maxRedemptions !== null &&
        coupon.redemptionCount >= coupon.maxRedemptions) ||
      !coupon.promotion.active ||
      (coupon.promotion.maxRedemptions !== null &&
        coupon.promotion.redemptionCount >= coupon.promotion.maxRedemptions)
    )
      throw new CheckoutValidationError(
        'El cupón no es válido o ya no está disponible.',
      );
    if (session.customerId && coupon.perCustomerLimit !== null) {
      const uses = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, customerId: session.customerId },
      });
      if (uses >= coupon.perCustomerLimit)
        throw new CheckoutValidationError(
          'El cliente ya alcanzó el límite de uso del cupón.',
        );
    }
    const result = calculateDiscount(
      toPromotionLines(session),
      [mapPromotion(coupon.promotion)],
      mapCoupon(coupon),
    );
    if (Number(result.discountTotal) <= 0)
      throw new CheckoutValidationError(
        'El cupón no aplica al carrito actual.',
      );
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: { couponId: coupon.id },
        include: sessionInclude,
      }),
    );
  }
  public async clearCoupon(id: string, owner: CheckoutOwner) {
    await this.authorizedSession(id, owner);
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: { couponId: null },
        include: sessionInclude,
      }),
    );
  }

  public async confirm(id: string, owner: CheckoutOwner) {
    const existing = await this.authorizedSession(id, owner);
    if (existing.status === 'COMPLETED') {
      if (!existing.orderId)
        throw new CheckoutConflictError(
          'La sesión figura completada pero no tiene pedido.',
        );
      const order = await this.prisma.order.findUnique({
        where: { id: existing.orderId },
        include: orderInclude,
      });
      if (!order)
        throw new CheckoutConflictError(
          'La sesión figura completada pero no tiene pedido.',
        );
      return { order: mapOrder(order), publicToken: '' };
    }
    validateReady(existing);
    const publicToken = createAnonymousToken();
    const order = await this.prisma.$transaction(
      async (transaction) => {
        const session = await transaction.checkoutSession.findUnique({
          where: { id },
          include: sessionInclude,
        });
        if (!session || session.status !== 'DRAFT')
          throw new CheckoutConflictError('La sesión ya fue procesada.');
        if (session.expiresAt < new Date())
          throw new CheckoutConflictError('La sesión de checkout expiró.');
        if (!session)
          throw new CheckoutConflictError('La sesión ya fue procesada.');
        const lines = session.cart.items;
        const variants = await transaction.productVariant.findMany({
          where: {
            id: { in: lines.map((line) => line.variantId) },
            active: true,
          },
          include: {
            product: { include: { brand: true, category: true } },
            inventory: true,
          },
        });
        if (variants.length !== lines.length)
          throw new CheckoutConflictError(
            'Una variante dejó de estar disponible.',
          );
        const byId = new Map(
          variants.map((variant) => [variant.id, variant] as const),
        );
        const promotionRows = await transaction.promotion.findMany({
          where: { active: true },
          include: { targets: true, bundleItems: true },
        });
        const coupon = session.coupon
          ? await transaction.coupon.findUnique({
              where: { id: session.coupon.id },
              include: {
                promotion: { include: { targets: true, bundleItems: true } },
              },
            })
          : null;
        if (
          coupon &&
          (!coupon.active ||
            !isWithinPeriod(coupon.startsAt, coupon.endsAt) ||
            (coupon.maxRedemptions !== null &&
              coupon.redemptionCount >= coupon.maxRedemptions) ||
            !coupon.promotion.active ||
            (coupon.promotion.maxRedemptions !== null &&
              coupon.promotion.redemptionCount >=
                coupon.promotion.maxRedemptions))
        )
          throw new CheckoutConflictError('El cupón dejó de estar disponible.');
        const promotionLines: PromotionLine[] = lines.map((line) => {
          const variant = byId.get(line.variantId);
          if (
            !variant?.salePrice ||
            !variant.product ||
            Number(variant.salePrice) <= 0
          )
            throw new CheckoutConflictError(
              'Una variante dejó de tener precio.',
            );
          const available =
            (variant.inventory?.onHand ?? 0) -
            (variant.inventory?.reserved ?? 0);
          if (available < line.quantity)
            throw new CheckoutConflictError(
              `No hay stock suficiente para ${variant.product.name}.`,
            );
          return {
            variantId: variant.id,
            productId: variant.productId,
            categoryId: variant.product.categoryId,
            brandId: variant.product.brandId,
            quantity: line.quantity,
            unitPrice: variant.salePrice.toString(),
          };
        });
        const discount = calculateDiscount(
          promotionLines,
          promotionRows.map(mapPromotion),
          coupon ? mapCoupon(coupon) : null,
        );
        const subtotal = promotionLines.reduce(
          (sum: number, line: PromotionLine) =>
            sum + Number(line.unitPrice) * line.quantity,
          0,
        );
        const shippingCost = Number(session.shippingCost);
        const total = Math.max(
          0,
          subtotal - Number(discount.discountTotal) + shippingCost,
        );
        const externalPayment = session.paymentMethod === 'MERCADO_PAGO';
        const created = await transaction.order.create({
          data: {
            id: randomUUID(),
            customerId: session.customerId,
            status: externalPayment ? 'PENDING_PAYMENT' : 'PAID',
            paymentStatus: externalPayment ? 'PENDING' : 'PAID',
            paymentMethod: session.paymentMethod,
            paymentReference: externalPayment
              ? null
              : `SIMULATED-${randomUUID()}`,
            currency: 'ARS',
            subtotal: subtotal.toFixed(2),
            discountTotal: discount.discountTotal,
            couponCode: discount.couponCode,
            shippingOptionId: session.shippingOptionId,
            shippingMethod: session.shippingOption?.name ?? null,
            shippingZoneId: session.shippingZoneId,
            shippingEstimate: session.shippingEstimate,
            shippingCost: shippingCost.toFixed(2),
            total: total.toFixed(2),
            contactName: session.contactName!,
            contactEmail: session.contactEmail!,
            contactPhone: session.contactPhone,
            shippingAddress: session.shippingAddress as Prisma.InputJsonObject,
            publicAccessTokenHash: hashAnonymousToken(publicToken),
            lines: {
              create: promotionLines.map((line) => {
                const variant = byId.get(line.variantId);
                if (!variant)
                  throw new CheckoutValidationError(
                    'La variante del pedido ya no está disponible.',
                  );
                return {
                  id: randomUUID(),
                  variantId: line.variantId,
                  productName: variant.product.name,
                  sku: variant.sku,
                  presentation: variant.presentation,
                  unitPrice: line.unitPrice,
                  quantity: line.quantity,
                  lineTotal: (Number(line.unitPrice) * line.quantity).toFixed(
                    2,
                  ),
                };
              }),
            },
            ...(externalPayment
              ? {}
              : {
                  payments: {
                    create: {
                      id: randomUUID(),
                      amount: total.toFixed(2),
                      method: session.paymentMethod!,
                      reference: 'SIMULATED',
                      paidAt: new Date(),
                    },
                  },
                }),
          },
          include: orderInclude,
        });
        for (const line of promotionLines) {
          await transaction.inventoryItem.update({
            where: { variantId: line.variantId },
            data: { reserved: { increment: line.quantity } },
          });
          await transaction.inventoryMovement.create({
            data: {
              id: randomUUID(),
              variantId: line.variantId,
              orderId: created.id,
              type: 'RESERVE',
              quantity: line.quantity,
              reason: externalPayment
                ? 'Reserva de checkout Mercado Pago'
                : 'Reserva de checkout simulado',
            },
          });
        }
        if (coupon && discount.couponCode) {
          if (session.customerId && coupon.perCustomerLimit !== null) {
            const count = await transaction.couponRedemption.count({
              where: { couponId: coupon.id, customerId: session.customerId },
            });
            if (count >= coupon.perCustomerLimit)
              throw new CheckoutConflictError(
                'El cliente ya alcanzó el límite de uso del cupón.',
              );
          }
          await transaction.couponRedemption.create({
            data: {
              id: randomUUID(),
              couponId: coupon.id,
              orderId: created.id,
              customerId: session.customerId,
            },
          });
          await transaction.coupon.update({
            where: { id: coupon.id },
            data: { redemptionCount: { increment: 1 } },
          });
          await transaction.promotion.update({
            where: { id: coupon.promotionId },
            data: { redemptionCount: { increment: 1 } },
          });
        }
        await transaction.cart.update({
          where: { id: session.cartId },
          data: {
            status: 'CONVERTED',
            convertedOrderId: created.id,
            lastActivityAt: new Date(),
          },
        });
        await transaction.checkoutSession.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            stage: 'CONFIRMATION',
            orderId: created.id,
          },
        });
        return created;
      },
      { isolationLevel: 'Serializable' },
    );
    return {
      order: mapOrder(order),
      publicToken,
      ...(order.paymentStatus === 'PENDING' ? { paymentRequired: true } : {}),
    };
  }

  public async findPublicOrder(id: string, tokenHash: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, publicAccessTokenHash: tokenHash },
      include: orderInclude,
    });
    if (!order)
      throw new CheckoutNotFoundError(
        'El pedido no existe o el token no es válido.',
      );
    return mapOrder(order);
  }
  public async listCustomerOrders(customerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { customerId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(mapOrder);
  }
  public async findCustomerOrder(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: orderInclude,
    });
    if (!order) throw new CheckoutNotFoundError('El pedido no existe.');
    return mapOrder(order);
  }

  public async findPetPurchaseHistory(customerId: string, petId: string) {
    const plans = await this.prisma.replenishmentPlan.findMany({
      where: { customerId, petId, orderId: { not: null } },
      include: {
        order: { select: { id: true, createdAt: true } },
        variant: { include: { product: true } },
      },
      orderBy: { order: { createdAt: 'asc' } },
    });
    const items = plans.map((plan, index) => {
      const previous = index > 0 ? plans[index - 1].order?.createdAt : null;
      const date = plan.order!.createdAt;
      return {
        id: plan.order!.id,
        petId,
        date,
        foodName: plan.variant.product.name,
        presentation: plan.presentationSnapshot ?? plan.variant.presentation,
        daysSincePrevious: previous
          ? Math.round((date.getTime() - previous.getTime()) / 86_400_000)
          : null,
      };
    });
    const intervals = items
      .map((item) => item.daysSincePrevious)
      .filter((days): days is number => days !== null);
    return {
      items,
      averageDays: intervals.length
        ? Math.round(
            intervals.reduce((sum, days) => sum + days, 0) / intervals.length,
          )
        : null,
    };
  }

  private async authorizedSession(
    id: string,
    owner: CheckoutOwner,
  ): Promise<SessionRecord> {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (
      !session ||
      (owner.customerId
        ? session.customerId !== owner.customerId
        : session.accessTokenHash !== owner.tokenHash)
    )
      throw new CheckoutNotFoundError();
    return session;
  }

  private async resumeSession(value: SessionRecord, token: string) {
    if (value.status === 'COMPLETED')
      throw new CheckoutConflictError(
        'El carrito ya fue convertido en pedido.',
      );
    const session = await this.prisma.checkoutSession.update({
      where: { id: value.id },
      data: {
        status: 'DRAFT',
        accessTokenHash: hashAnonymousToken(token),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
      include: sessionInclude,
    });
    return { session: await this.toSession(session), token };
  }

  private async toSession(value: SessionRecord): Promise<CheckoutSession> {
    const promotions = await this.prisma.promotion.findMany({
      where: { active: true },
      include: { targets: true, bundleItems: true },
    });
    return mapSession(value, promotions.map(mapPromotion));
  }
}

const validateReady = (session: SessionRecord) => {
  if (
    !session.contactName ||
    !session.contactEmail ||
    !session.shippingAddress ||
    !session.shippingOptionId ||
    !session.paymentMethod
  )
    throw new CheckoutValidationError(
      'Completa datos, dirección, envío y pago antes de confirmar.',
    );
};
const toPromotionLines = (session: SessionRecord): PromotionLine[] =>
  session.cart.items.map((item) => ({
    variantId: item.variantId,
    productId: item.variant.productId,
    categoryId: item.variant.product.categoryId,
    brandId: item.variant.product.brandId,
    quantity: item.quantity,
    unitPrice: item.variant.salePrice?.toString() ?? '0.00',
  }));
const mapPromotion = (value: PromotionRecord): Promotion => ({
  id: value.id,
  name: value.name,
  type: value.type,
  kind: value.kind ?? 'DISCOUNT',
  value: value.value.toString(),
  active: value.active,
  startsAt: value.startsAt,
  endsAt: value.endsAt,
  priority: value.priority,
  minimumSubtotal: value.minimumSubtotal?.toString() ?? null,
  maxRedemptions: value.maxRedemptions,
  redemptionCount: value.redemptionCount,
  targets: value.targets.map((target) => ({
    productId: target.productId,
    variantId: target.variantId,
    categoryId: target.categoryId,
    brandId: target.brandId,
  })),
  bundleItems: value.bundleItems.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  })),
});
const mapCoupon = (value: CouponRecord): Coupon => ({
  id: value.id,
  promotionId: value.promotionId,
  code: value.code,
  active: value.active,
  startsAt: value.startsAt,
  endsAt: value.endsAt,
  maxRedemptions: value.maxRedemptions,
  redemptionCount: value.redemptionCount,
  perCustomerLimit: value.perCustomerLimit,
  promotion: mapPromotion(value.promotion),
});
const mapSession = (
  value: SessionRecord,
  promotions: Promotion[] = [],
): CheckoutSession => {
  const items = value.cart.items.map((item): CartItem => ({
    id: item.id,
    variantId: item.variantId,
    productId: item.variant.productId,
    productName: item.variant.product.name,
    slug: item.variant.product.slug,
    sku: item.variant.sku,
    presentation: item.variant.presentation,
    imageUrl: item.variant.product.media?.[0]?.url ?? null,
    unitPrice: item.variant.salePrice?.toString() ?? '0.00',
    quantity: item.quantity,
    lineTotal: (Number(item.variant.salePrice ?? 0) * item.quantity).toFixed(2),
    availableQuantity: Math.max(
      0,
      (item.variant.inventory?.onHand ?? 0) -
        (item.variant.inventory?.reserved ?? 0),
    ),
  }));
  const subtotal = items.reduce(
    (sum: number, item: CartItem) => sum + Number(item.lineTotal),
    0,
  );
  const discount = calculateDiscount(
    toPromotionLines(value),
    promotions,
    value.coupon ? mapCoupon(value.coupon) : null,
  );
  const shipping = Number(value.shippingCost ?? 0);
  return {
    id: value.id,
    cartId: value.cartId,
    customerId: value.customerId,
    stage: value.stage,
    status: value.status,
    contactName: value.contactName,
    contactEmail: value.contactEmail,
    contactPhone: value.contactPhone,
    shippingAddress: value.shippingAddress as Record<string, string> | null,
    shippingOptionId: value.shippingOptionId,
    shippingZoneId: value.shippingZoneId ?? null,
    shippingEstimate: value.shippingEstimate ?? null,
    shippingCost: shipping.toFixed(2),
    paymentMethod: value.paymentMethod,
    couponCode: discount.couponCode,
    orderId: value.orderId ?? null,
    subtotal: subtotal.toFixed(2),
    discountTotal: discount.discountTotal,
    total: Math.max(
      0,
      subtotal - Number(discount.discountTotal) + shipping,
    ).toFixed(2),
    items,
    expiresAt: value.expiresAt,
  };
};
const mapOrder = (
  value: Prisma.OrderGetPayload<{ include: typeof orderInclude }>,
): OrderSummary => ({
  id: value.id,
  status: value.status,
  paymentStatus: value.paymentStatus,
  subtotal: value.subtotal.toString(),
  discountTotal: value.discountTotal?.toString() ?? '0.00',
  shippingCost: value.shippingCost.toString(),
  total: value.total.toString(),
  currency: 'ARS',
  contactName: value.contactName,
  contactEmail: value.contactEmail,
  petName: value.replenishmentPlans[0]?.petName ?? null,
  date: value.createdAt,
  lines: value.lines.map((line) => ({
    variantId: line.variantId,
    productName: line.productName,
    presentation: line.presentation,
    quantity: line.quantity,
    unitPrice: line.unitPrice.toString(),
    lineTotal: line.lineTotal.toString(),
  })),
  createdAt: value.createdAt,
});
