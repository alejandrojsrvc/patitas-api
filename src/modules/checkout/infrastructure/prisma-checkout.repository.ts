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
import {
  calculateShipping,
  type ShippingDeliverySlot,
} from '../../shipping/domain/shipping-calculator';
import type { ShippingZone } from '../../shipping/domain/shipping.types';

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
const RESERVATION_TTL_MS = 30 * 60 * 1000;
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
    await this.authorizedSession(id, owner, true);
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
    deliveryInstructions?: string | null,
  ) {
    await this.authorizedSession(id, owner, true);
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: {
          shippingAddress: address,
          shippingOptionId: null,
          shippingCost: 0,
          shippingProviderCost: 0,
          shippingSubsidy: 0,
          shippingDeliveryCount: 0,
          shippingVat: 0,
          shippingZoneId: null,
          shippingEstimate: null,
          ...(deliveryInstructions !== undefined
            ? { deliveryInstructions: deliveryInstructions ?? null }
            : {}),
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
    deliverySlotId?: string,
  ) {
    const session = await this.authorizedSession(id, owner, true);
    const option = await this.prisma.shippingOption.findFirst({
      where: { id: shippingOptionId, active: true },
    });
    if (!option)
      throw new CheckoutValidationError(
        'La opción de envío no está disponible.',
      );
    const [zones, pricingRules, promotions] = await Promise.all([
      this.prisma.shippingZone.findMany({
        where: { active: true },
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.pricingRuleSet.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { version: 'desc' },
        select: { subsidizedShippingCost: true },
      }),
      this.prisma.promotion.findMany({
        where: { active: true },
        include: { targets: true, bundleItems: true },
      }),
    ]);
    const discount = calculateDiscount(
      toPromotionLines(session),
      promotions.map(mapPromotion),
      session.coupon ? mapCoupon(session.coupon) : null,
    );
    const discountedSubtotal = Math.max(
      0,
      session.cart.items.reduce(
        (sum: number, item: CheckoutItem) =>
          sum + Number(item.variant?.salePrice ?? 0) * item.quantity,
        0,
      ) - Number(discount.discountTotal),
    );
    const weightGrams = session.cart.items.reduce<number | undefined>(
      (total, item) =>
        total === undefined || item.variant.weightGrams === null
          ? undefined
          : total + item.variant.weightGrams * item.quantity,
      0,
    );
    const address = (session.shippingAddress ?? {}) as Record<string, string>;
    const quote = calculateShipping(
      zones.map(mapShippingZone),
      {
        postalCode: address.postalCode,
        neighborhood: address.neighborhood,
        city: address.city,
        province: address.province,
        subtotal: discountedSubtotal.toFixed(2),
        weightGrams,
        stockAvailable: session.cart.items.every(
          (item) =>
            (item.variant.inventory?.onHand ?? 0) -
              (item.variant.inventory?.reserved ?? 0) >=
            item.quantity,
        ),
      },
      pricingRules?.subsidizedShippingCost?.toString() ?? '0.00',
    );
    if (!quote.available) throw new CheckoutValidationError(quote.message);
    const deliverySlot = selectDeliverySlot(
      quote.deliverySlots,
      deliverySlotId,
    );
    if (!deliverySlot)
      throw new CheckoutValidationError(
        'La franja horaria de envío ya no está disponible.',
      );
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: {
          shippingOptionId,
          shippingCost: quote.cost,
          shippingProviderCost: quote.providerCost,
          shippingSubsidy: quote.subsidy,
          shippingDeliveryCount: quote.deliveryCount,
          shippingVat: quote.vat,
          shippingDeliverySlot: deliverySlot.id,
          shippingDeliveryDate: new Date(`${deliverySlot.date}T00:00:00.000Z`),
          shippingZoneId: quote.zoneId,
          shippingEstimate: quote.estimate,
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
    savedPaymentMethodId?: string | null,
  ) {
    await this.authorizedSession(id, owner, true);
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: {
          paymentMethod,
          ...(savedPaymentMethodId !== undefined
            ? { savedPaymentMethodId }
            : {}),
          stage: 'CONFIRMATION',
        },
        include: sessionInclude,
      }),
    );
  }
  public async applyCoupon(id: string, owner: CheckoutOwner, code: string) {
    const session = await this.authorizedSession(id, owner, true);
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
        data: {
          couponId: coupon.id,
          shippingOptionId: null,
          shippingCost: 0,
          shippingProviderCost: 0,
          shippingSubsidy: 0,
          shippingDeliveryCount: 0,
          shippingVat: 0,
          shippingDeliverySlot: null,
          shippingDeliveryDate: null,
          shippingZoneId: null,
          shippingEstimate: null,
          stage: 'SHIPPING',
        },
        include: sessionInclude,
      }),
    );
  }
  public async clearCoupon(id: string, owner: CheckoutOwner) {
    await this.authorizedSession(id, owner, true);
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: {
          couponId: null,
          shippingOptionId: null,
          shippingCost: 0,
          shippingProviderCost: 0,
          shippingSubsidy: 0,
          shippingDeliveryCount: 0,
          shippingVat: 0,
          shippingDeliverySlot: null,
          shippingDeliveryDate: null,
          shippingZoneId: null,
          shippingEstimate: null,
          stage: 'SHIPPING',
        },
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
      const publicToken = createAnonymousToken();
      await this.prisma.order.update({
        where: { id: order.id },
        data: { publicAccessTokenHash: hashAnonymousToken(publicToken) },
      });
      return {
        order: mapOrder(order),
        publicToken,
        ...(order.paymentStatus === 'PENDING' ||
        order.paymentStatus === 'PROCESSING' ||
        order.paymentStatus === 'FAILED'
          ? { paymentRequired: true }
          : {}),
      };
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
        if (!lines.length)
          throw new CheckoutConflictError('El carrito está vacío.');
        const variants = await transaction.productVariant.findMany({
          where: {
            id: { in: lines.map((line) => line.variantId) },
            active: true,
          },
          include: {
            product: {
              include: {
                brand: true,
                category: true,
                media: { orderBy: { displayOrder: 'asc' as const } },
              },
            },
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
          if (!variant?.product || variant.product.status !== 'ACTIVE')
            throw new CheckoutConflictError(
              'Una variante dejó de estar disponible.',
            );
          if (!variant.salePrice || Number(variant.salePrice) <= 0)
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
        const shipping = await calculateCurrentShipping(
          transaction,
          session,
          Math.max(0, subtotal - Number(discount.discountTotal)),
        );
        const shippingCost = Number(shipping.cost);
        const total = Math.max(
          0,
          subtotal - Number(discount.discountTotal) + shippingCost,
        );
        const externalPayment = ['MERCADO_PAGO', 'PAYWAY'].includes(
          session.paymentMethod ?? '',
        );
        const created = await transaction.order.create({
          data: {
            id: randomUUID(),
            customerId: session.customerId,
            number: createOrderNumber(),
            source: owner.source ?? 'STORE',
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
            shippingZoneId: shipping.zoneId,
            shippingEstimate: shipping.estimate,
            shippingProviderCost: shipping.providerCost,
            shippingSubsidy: shipping.subsidy,
            shippingDeliveryCount: shipping.deliveryCount,
            shippingVat: shipping.vat,
            shippingDeliverySlot: shipping.deliverySlotId,
            shippingDeliveryDate: shipping.deliveryDate,
            reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
            shippingCost: shippingCost.toFixed(2),
            total: total.toFixed(2),
            contactName: session.contactName!,
            contactEmail: session.contactEmail!,
            contactPhone: session.contactPhone,
            shippingAddress: session.shippingAddress as Prisma.InputJsonObject,
            deliveryInstructions: session.deliveryInstructions,
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
                  role:
                    lines.find((item) => item.variantId === line.variantId)
                      ?.role ?? 'EXTRA',
                  petId:
                    lines.find((item) => item.variantId === line.variantId)
                      ?.petId ?? null,
                  planId:
                    lines.find((item) => item.variantId === line.variantId)
                      ?.planId ?? null,
                  imageUrl: variant.product.media?.[0]?.url ?? null,
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
          const variant = byId.get(line.variantId);
          const localAvailable =
            (variant?.inventory?.onHand ?? 0) -
            (variant?.inventory?.reserved ?? 0);
          if (localAvailable < line.quantity) continue;
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
                ? `Reserva de checkout ${session.paymentMethod}`
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
        await recordStatusEvent(transaction, created.id, created.status);
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
    mutable = false,
  ): Promise<SessionRecord> {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (
      !session ||
      !(
        (owner.customerId && session.customerId === owner.customerId) ||
        (owner.tokenHash && session.accessTokenHash === owner.tokenHash)
      )
    )
      throw new CheckoutNotFoundError();
    if (mutable && session.status !== 'DRAFT')
      throw new CheckoutConflictError(
        'La sesión de checkout ya no admite modificaciones.',
      );
    if (mutable && session.expiresAt <= new Date())
      throw new CheckoutConflictError('La sesión de checkout expiró.');
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

const createOrderNumber = (): string =>
  `PAT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;

const recordStatusEvent = async (
  transaction: Prisma.TransactionClient,
  orderId: string,
  status:
    | 'DRAFT'
    | 'PENDING_PAYMENT'
    | 'PAID'
    | 'PROCESSING'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED',
): Promise<void> => {
  const events = transaction.orderStatusEvent;
  if (!events) return;
  const existing = await events.findFirst({
    where: { orderId, status },
    select: { id: true },
  });
  if (existing) return;
  await events.create({ data: { id: randomUUID(), orderId, status } });
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
    role: item.role === 'MAIN' ? 'MAIN' : 'EXTRA',
    petId: item.petId,
    planId: item.planId,
    weightGrams: item.variant.weightGrams,
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
    deliveryInstructions: value.deliveryInstructions,
    shippingOptionId: value.shippingOptionId,
    shippingZoneId: value.shippingZoneId ?? null,
    shippingEstimate: value.shippingEstimate ?? null,
    shippingDeliverySlot: value.shippingDeliverySlot ?? null,
    shippingDeliveryDate: value.shippingDeliveryDate ?? null,
    shippingCost: shipping.toFixed(2),
    paymentMethod: value.paymentMethod,
    savedPaymentMethodId: value.savedPaymentMethodId,
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
const calculateCurrentShipping = async (
  transaction: Prisma.TransactionClient,
  session: SessionRecord,
  subtotal: number,
): Promise<{
  cost: string;
  providerCost: string;
  subsidy: string;
  deliveryCount: number;
  vat: string;
  deliverySlotId: string;
  deliveryDate: Date;
  zoneId: string | null;
  estimate: string | null;
}> => {
  const option = await transaction.shippingOption.findFirst({
    where: { id: session.shippingOptionId ?? '__missing__', active: true },
  });
  if (!option)
    throw new CheckoutConflictError(
      'La opción de envío ya no está disponible.',
    );
  const [zones, pricingRules] = await Promise.all([
    transaction.shippingZone.findMany({
      where: { active: true },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    }),
    transaction.pricingRuleSet.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { version: 'desc' },
      select: { subsidizedShippingCost: true },
    }),
  ]);
  const address = (session.shippingAddress ?? {}) as Record<string, string>;
  const weightGrams = session.cart.items.reduce<number | undefined>(
    (total, item) =>
      total === undefined || item.variant.weightGrams === null
        ? undefined
        : total + item.variant.weightGrams * item.quantity,
    0,
  );
  const quote = calculateShipping(
    zones.map(mapShippingZone),
    {
      postalCode: address.postalCode,
      neighborhood: address.neighborhood,
      city: address.city,
      province: address.province,
      subtotal: subtotal.toFixed(2),
      weightGrams,
      stockAvailable: session.cart.items.every(
        (item) =>
          (item.variant.inventory?.onHand ?? 0) -
            (item.variant.inventory?.reserved ?? 0) >=
          item.quantity,
      ),
    },
    pricingRules?.subsidizedShippingCost?.toString() ?? '0.00',
  );
  if (!quote.available) throw new CheckoutConflictError(quote.message);
  const deliverySlot = selectDeliverySlot(
    quote.deliverySlots,
    session.shippingDeliverySlot ?? undefined,
  );
  if (!deliverySlot)
    throw new CheckoutConflictError(
      'La franja horaria de envío ya no está disponible.',
    );
  return {
    ...quote,
    deliverySlotId: deliverySlot.id,
    deliveryDate: new Date(`${deliverySlot.date}T00:00:00.000Z`),
  };
};

const selectDeliverySlot = (
  slots: ShippingDeliverySlot[],
  id?: string,
): ShippingDeliverySlot | null =>
  slots.find((slot) => slot.id === (id ?? slots[0]?.id)) ?? null;

const mapShippingZone = (
  value: Prisma.ShippingZoneGetPayload<Prisma.ShippingZoneDefaultArgs>,
): ShippingZone => ({
  id: value.id,
  name: value.name,
  type: value.type,
  active: value.active,
  priority: value.priority,
  postalCodes: value.postalCodes ?? [],
  neighborhoods: value.neighborhoods ?? [],
  polygon: value.polygon ?? null,
  cost: value.cost.toString(),
  freeShippingFrom: value.freeShippingFrom?.toString() ?? null,
  maxWeightGrams: value.maxWeightGrams ?? null,
  estimatedDaysMin: value.estimatedDaysMin,
  estimatedDaysMax: value.estimatedDaysMax,
  deliveryWindows: value.deliveryWindows ?? null,
});

const mapOrder = (
  value: Prisma.OrderGetPayload<{ include: typeof orderInclude }>,
): OrderSummary => ({
  id: value.id,
  status: value.status,
  paymentStatus: value.paymentStatus,
  canRetry:
    value.status === 'PENDING_PAYMENT' &&
    value.paymentStatus === 'FAILED' &&
    !value.reconciliationRequired &&
    (!value.reservationExpiresAt || value.reservationExpiresAt > new Date()),
  reconciliationRequired: value.reconciliationRequired,
  reconciliationReason: value.reconciliationReason,
  reservationExpiresAt: value.reservationExpiresAt,
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
