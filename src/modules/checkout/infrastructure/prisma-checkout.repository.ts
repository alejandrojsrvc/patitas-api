import { Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { createAnonymousToken, hashAnonymousToken } from '../../../shared/application/anonymous-token';
import { calculateDiscount } from '../../promotions/domain/promotion-calculator';
import { isWithinPeriod } from '../../promotions/application/promotion.service';
import { CheckoutConflictError, CheckoutNotFoundError, CheckoutValidationError } from '../domain/checkout.error';
import type { CheckoutRepository } from '../domain/checkout.repository';
import type { CheckoutOwner, CheckoutSession, OrderSummary } from '../domain/checkout.types';
import type { CartItem } from '../../cart/domain/cart.types';
import type { Coupon, Promotion, PromotionLine } from '../../promotions/domain/promotion.types';
import { calculateCheckoutPricing } from '../domain/checkout-pricing';
import type { PaymentMethodBenefitService } from '../../payments/application/payment-method-benefit.service';
import { calculateShipping, type ShippingDeliverySlot } from '../../shipping/domain/shipping-calculator';
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
  shippingZone: true,
  purchaseSchedule: true,
} as const;
const orderInclude = {
  lines: true,
  replenishmentPlans: { select: { petName: true } },
  benefits: { orderBy: { createdAt: 'asc' as const } },
} as const;
const RESERVATION_TTL_MS = 30 * 60 * 1000;
const MANUAL_TRANSFER_PROVIDER = 'manual_transfer';
type SessionRecord = Prisma.CheckoutSessionGetPayload<{
  include: typeof sessionInclude;
}>;
type PromotionRecord = Prisma.PromotionGetPayload<{
  include: { targets: true; bundleItems: true };
}>;
type CouponRecord = Prisma.CouponGetPayload<{
  include: { promotion: { include: { targets: true; bundleItems: true } } };
}>;
@Injectable()
export class PrismaCheckoutRepository implements CheckoutRepository {
  public constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly paymentBenefits?: PaymentMethodBenefitService,
  ) {}

  public async create(cartId: string, owner: CheckoutOwner) {
    if (!owner.customerId && !owner.tokenHash) throw new CheckoutValidationError('Se requiere la sesión del carrito.');
    const cart = await this.prisma.cart.findFirst({
      where: {
        id: cartId,
        status: { in: ['ACTIVE', 'ABANDONED'] },
        ...(owner.customerId ? { customerId: owner.customerId } : { anonymousTokenHash: owner.tokenHash }),
      },
      include: { items: true },
    });
    if (!cart || !cart.items.length) throw new CheckoutValidationError('El carrito no existe o está vacío.');
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
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
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
  public async setAddress(id: string, owner: CheckoutOwner, address: Record<string, string>, deliveryInstructions?: string | null) {
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
          shippingDeliverySlot: null,
          shippingDeliveryDate: null,
          ...(deliveryInstructions !== undefined ? { deliveryInstructions: deliveryInstructions ?? null } : {}),
          stage: 'SHIPPING',
        },
        include: sessionInclude,
      }),
    );
  }
  public async setShippingOption(id: string, owner: CheckoutOwner, shippingOptionId: string, deliverySlotId?: string, deliveryDate?: string) {
    const session = await this.authorizedSession(id, owner, true);
    const option = await this.prisma.shippingOption.findFirst({
      where: { id: shippingOptionId, active: true },
    });
    if (!option) throw new CheckoutValidationError('La opción de envío no está disponible.');
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
    const scheduledDiscount = scheduledDiscountForSession(session);
    const pricing = calculateCheckoutPricing({
      lines: toPromotionLines(session),
      promotions: promotions.map(mapPromotion),
      coupon: session.coupon ? mapCoupon(session.coupon) : null,
      scheduledPurchase: scheduledPurchaseInput(session, scheduledDiscount),
    });
    const discountedSubtotal = Math.max(0, Number(pricing.subtotal) - Number(pricing.productDiscountTotal));
    const weightGrams = session.cart.items.reduce<number | undefined>(
      (total, item) => (total === undefined || item.variant.weightGrams === null ? undefined : total + item.variant.weightGrams * item.quantity),
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
          (item) => (item.variant.inventory?.onHand ?? 0) - (item.variant.inventory?.reserved ?? 0) >= item.quantity,
        ),
      },
      pricingRules?.subsidizedShippingCost?.toString() ?? '0.00',
    );
    if (!quote.available) throw new CheckoutValidationError(quote.message);
    const deliverySlot = selectDeliverySlot(quote.deliverySlots, deliverySlotId, deliveryDate);
    if (!deliverySlot)
      throw new CheckoutConflictError(
        'La fecha de entrega seleccionada ya no está disponible. Elegí otra.',
        undefined,
        'DELIVERY_DATE_UNAVAILABLE_CONFLICT',
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
  public async setPaymentMethod(id: string, owner: CheckoutOwner, paymentMethod: string, savedPaymentMethodId?: string | null) {
    await this.authorizedSession(id, owner, true);
    return this.toSession(
      await this.prisma.checkoutSession.update({
        where: { id },
        data: {
          paymentMethod,
          ...(savedPaymentMethodId !== undefined ? { savedPaymentMethodId } : {}),
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
      (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) ||
      !coupon.promotion.active ||
      (coupon.promotion.maxRedemptions !== null && coupon.promotion.redemptionCount >= coupon.promotion.maxRedemptions)
    )
      throw new CheckoutValidationError('El cupón no es válido o ya no está disponible.');
    if (session.purchaseSchedule) {
      throw new CheckoutConflictError('Los cupones no son acumulables con la compra programada.');
    }
    if (session.customerId && coupon.perCustomerLimit !== null) {
      const uses = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, customerId: session.customerId },
      });
      if (uses >= coupon.perCustomerLimit) throw new CheckoutValidationError('El cliente ya alcanzó el límite de uso del cupón.');
    }
    const result = calculateDiscount(toPromotionLines(session), [mapPromotion(coupon.promotion)], mapCoupon(coupon));
    if (Number(result.discountTotal) <= 0) throw new CheckoutValidationError('El cupón no aplica al carrito actual.');
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
      if (!existing.orderId) throw new CheckoutConflictError('La sesión figura completada pero no tiene pedido.');
      const order = await this.prisma.order.findUnique({
        where: { id: existing.orderId },
        include: orderInclude,
      });
      if (!order) throw new CheckoutConflictError('La sesión figura completada pero no tiene pedido.');
      const publicToken = createAnonymousToken();
      await this.prisma.order.update({
        where: { id: order.id },
        data: { publicAccessTokenHash: hashAnonymousToken(publicToken) },
      });
      return {
        order: mapOrder(order),
        publicToken,
        ...(order.paymentStatus === 'PENDING' || order.paymentStatus === 'PROCESSING' || order.paymentStatus === 'FAILED'
          ? { paymentRequired: true }
          : {}),
      };
    }
    validateReady(existing);
    const publicToken = createAnonymousToken();
    let order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
    try {
      order = await this.prisma.$transaction(
        async (transaction) => {
          const session = await transaction.checkoutSession.findUnique({
            where: { id },
            include: sessionInclude,
          });
          if (!session || session.status !== 'DRAFT') throw new CheckoutConflictError('La sesión ya fue procesada.');
          if (session.expiresAt < new Date())
            throw new CheckoutConflictError('La sesión de checkout expiró.', undefined, 'CHECKOUT_SESSION_EXPIRED_CONFLICT');
          if (!session) throw new CheckoutConflictError('La sesión ya fue procesada.');
          const lines = session.cart.items;
          if (!lines.length) throw new CheckoutConflictError('El carrito está vacío.');
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
          if (variants.length !== new Set(lines.map((line) => line.variantId)).size)
            throw new CheckoutConflictError('Una variante dejó de estar disponible.');
          const byId = new Map(variants.map((variant) => [variant.id, variant] as const));
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
          if (session.purchaseSchedule && coupon) throw new CheckoutConflictError('Una compra programada no puede combinarse con un cupón.');
          if (
            coupon &&
            (!coupon.active ||
              !isWithinPeriod(coupon.startsAt, coupon.endsAt) ||
              (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) ||
              !coupon.promotion.active ||
              (coupon.promotion.maxRedemptions !== null && coupon.promotion.redemptionCount >= coupon.promotion.maxRedemptions))
          )
            throw new CheckoutConflictError('El cupón dejó de estar disponible.');
          const requestedQuantityByVariant = new Map<string, number>();
          for (const line of lines) {
            requestedQuantityByVariant.set(line.variantId, (requestedQuantityByVariant.get(line.variantId) ?? 0) + line.quantity);
          }
          const promotionLines: PromotionLine[] = lines.map((line) => {
            const variant = byId.get(line.variantId);
            if (!variant?.product || variant.product.status !== 'ACTIVE') throw new CheckoutConflictError('Una variante dejó de estar disponible.');
            if (!variant.salePrice || Number(variant.salePrice) <= 0) throw new CheckoutConflictError('Una variante dejó de tener precio.');
            const available = (variant.inventory?.onHand ?? 0) - (variant.inventory?.reserved ?? 0);
            if (available < (requestedQuantityByVariant.get(line.variantId) ?? line.quantity))
              throw new CheckoutConflictError(`No hay stock suficiente para ${variant.product.name}.`);
            return {
              variantId: variant.id,
              productId: variant.productId,
              categoryId: variant.product.categoryId,
              brandId: variant.product.brandId,
              quantity: line.quantity,
              unitPrice: variant.salePrice.toString(),
            };
          });
          const scheduledDiscount = scheduledDiscountForSession(session);
          const subtotal = promotionLines.reduce((sum: number, line: PromotionLine) => sum + Number(line.unitPrice) * line.quantity, 0);
          const transferConfiguration =
            session.paymentMethod === 'BANK_TRANSFER'
              ? await transaction.paymentMethodBenefitConfiguration.findUnique({
                  where: { paymentMethod: 'BANK_TRANSFER' },
                })
              : null;
          if (session.paymentMethod === 'BANK_TRANSFER' && (!transferConfiguration?.enabled || !transferConfiguration.instructions))
            throw new CheckoutConflictError('La transferencia no está habilitada o no tiene datos bancarios configurados.');
          const pricingWithoutShipping = calculateCheckoutPricing({
            lines: promotionLines,
            promotions: promotionRows.map(mapPromotion),
            coupon: coupon ? mapCoupon(coupon) : null,
            scheduledPurchase: scheduledPurchaseInput(session, scheduledDiscount),
            paymentMethod: session.paymentMethod,
            paymentBenefit: transferConfiguration
              ? {
                  enabled: transferConfiguration.enabled,
                  discountPercent: transferConfiguration.discountPercent.toString(),
                }
              : null,
          });
          const shipping = await calculateCurrentShipping(
            transaction,
            session,
            Math.max(0, Number(pricingWithoutShipping.subtotal) - Number(pricingWithoutShipping.productDiscountTotal)),
          );
          const priorOrder = await findConfirmedPurchase(transaction, session.customerId, session.contactEmail);
          const shippingBenefit =
            Number(shipping.remainingForFreeShipping ?? '1') === 0 && Number(shipping.cost) > 0
              ? {
                  origin: 'FREE_SHIPPING_THRESHOLD',
                  description: 'Envío gratis por monto mínimo',
                  amount: shipping.cost,
                }
              : !priorOrder && Number(shipping.cost) > 0
                ? {
                    origin: 'FIRST_ORDER_FREE_SHIPPING',
                    description: 'Primer envío gratis',
                    amount: shipping.cost,
                  }
                : null;
          const pricing = calculateCheckoutPricing({
            lines: promotionLines,
            promotions: promotionRows.map(mapPromotion),
            coupon: coupon ? mapCoupon(coupon) : null,
            scheduledPurchase: scheduledPurchaseInput(session, scheduledDiscount),
            paymentMethod: session.paymentMethod,
            paymentBenefit: transferConfiguration
              ? {
                  enabled: transferConfiguration.enabled,
                  discountPercent: transferConfiguration.discountPercent.toString(),
                }
              : null,
            shipping: {
              cost: shipping.cost,
              benefit: shippingBenefit,
            },
          });
          const manualTransfer = session.paymentMethod === 'BANK_TRANSFER';
          const orderId = randomUUID();
          const orderNumber = createOrderNumber();
          const reservationExpiresAt = new Date(
            Date.now() + (manualTransfer ? (transferConfiguration?.expirationMinutes ?? 120) * 60 * 1000 : RESERVATION_TTL_MS),
          );
          const couponApplied = Boolean(coupon && pricing.benefits.some((benefit) => benefit.type === 'COUPON'));
          const created = await transaction.order.create({
            data: {
              id: orderId,
              customerId: session.customerId,
              number: orderNumber,
              source: owner.source ?? 'STORE',
              status: 'PENDING_PAYMENT',
              paymentStatus: 'PENDING',
              paymentMethod: session.paymentMethod,
              paymentReference: null,
              currency: 'ARS',
              subtotal: subtotal.toFixed(2),
              discountTotal: pricing.discountTotal,
              couponCode: couponApplied ? (coupon?.code ?? null) : null,
              shippingOptionId: session.shippingOptionId,
              shippingMethod: null,
              shippingZoneId: shipping.zoneId,
              shippingZoneName: shipping.zoneName,
              shippingTariff: shipping.tariff,
              shippingEstimate: shipping.estimate,
              shippingProviderCost: shipping.providerCost,
              shippingSubsidy: shipping.subsidy,
              shippingDeliveryCount: shipping.deliveryCount,
              shippingVat: shipping.vat,
              shippingDeliverySlot: shipping.deliverySlotId,
              shippingDeliverySlotLabel: shipping.deliverySlotLabel,
              shippingDeliveryDate: shipping.deliveryDate,
              reservationExpiresAt,
              paymentExpiresAt: reservationExpiresAt,
              shippingCost: pricing.shippingCost,
              total: pricing.total,
              contactName: session.contactName!,
              contactEmail: session.contactEmail!,
              contactPhone: session.contactPhone,
              shippingAddress: session.shippingAddress as Prisma.InputJsonObject,
              deliveryInstructions: session.deliveryInstructions,
              publicAccessTokenHash: hashAnonymousToken(publicToken),
              lines: {
                create: promotionLines.map((line, index) => {
                  const variant = byId.get(line.variantId);
                  const cartLine = lines[index];
                  if (!variant) throw new CheckoutValidationError('La variante del pedido ya no está disponible.');
                  return {
                    id: randomUUID(),
                    variantId: line.variantId,
                    productName: variant.product.name,
                    sku: variant.sku,
                    presentation: variant.presentation,
                    unitPrice: line.unitPrice,
                    quantity: line.quantity,
                    lineTotal: (Number(line.unitPrice) * line.quantity).toFixed(2),
                    role: cartLine?.role ?? 'EXTRA',
                    petId: cartLine?.petId ?? null,
                    planId: cartLine?.planId ?? null,
                    imageUrl: variant.product.media?.[0]?.url ?? null,
                  };
                }),
              },
              benefits: {
                create: pricing.benefits.map((benefit) => ({
                  type: benefit.type,
                  scope: benefit.scope,
                  origin: benefit.origin,
                  sourceId: benefit.sourceId,
                  sourceCode: benefit.sourceCode,
                  description: benefit.description,
                  percentage: benefit.percentage,
                  amount: benefit.amount,
                  currency: 'ARS',
                  // El beneficio se muestra y se congela en el checkout,
                  // pero se consume recién cuando existe una captura pagada.
                  // Esto permite que varios checkouts pendientes sigan siendo
                  // elegibles sin reservar el beneficio antes del pago.
                  claimKey: null,
                })),
              },
              ...(manualTransfer
                ? {
                    paymentAttempts: {
                      create: {
                        id: randomUUID(),
                        provider: MANUAL_TRANSFER_PROVIDER,
                        externalReference: orderNumber,
                        status: 'PENDING',
                        amount: pricing.total,
                        currency: 'ARS',
                        idempotencyKey: `manual-transfer:${orderId}`,
                        expiresAt: reservationExpiresAt,
                        requestFingerprint: createPaymentFingerprint({
                          orderId,
                          amount: pricing.total,
                          currency: 'ARS',
                        }),
                      },
                    },
                  }
                : {}),
            },
            include: orderInclude,
          });
          for (const line of promotionLines) {
            const variant = byId.get(line.variantId);
            const localAvailable = (variant?.inventory?.onHand ?? 0) - (variant?.inventory?.reserved ?? 0);
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
                reason: `Reserva de checkout ${session.paymentMethod}`,
              },
            });
          }
          if (coupon && couponApplied) {
            if (session.customerId && coupon.perCustomerLimit !== null) {
              const count = await transaction.couponRedemption.count({
                where: { couponId: coupon.id, customerId: session.customerId },
              });
              if (count >= coupon.perCustomerLimit) throw new CheckoutConflictError('El cliente ya alcanzó el límite de uso del cupón.');
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
          if (session.purchaseSchedule) {
            const firstLine = created.lines.find((line) => line.variantId === session.purchaseSchedule?.variantId);
            const nextOrderAt = addDays(created.createdAt, session.purchaseSchedule.frequencyDays);
            await transaction.purchaseSchedule.update({
              where: { id: session.purchaseSchedule.id },
              data: {
                initialOrderId: created.id,
                orderLineId: firstLine?.id ?? null,
                status: 'PENDING_PAYMENT',
                nextOrderAt,
                nextReminderAt: addDays(nextOrderAt, -session.purchaseSchedule.leadDays),
              },
            });
          }
          await recordStatusEvent(transaction, created.id, created.status);
          return created;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.message).includes('order_benefits_claim_key')
      )
        throw new CheckoutConflictError('El beneficio de primer envío ya fue reservado por otra compra.');
      throw error;
    }
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
    if (!order) throw new CheckoutNotFoundError('El pedido no existe o el token no es válido.');
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
  public async listCustomerOrderPage(customerId: string, page: number, perPage: number) {
    const where = { customerId };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          number: true,
          status: true,
          paymentStatus: true,
          total: true,
          currency: true,
          createdAt: true,
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: orders.map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total.toString(),
        currency: 'ARS' as const,
        lineCount: order._count.lines,
        createdAt: order.createdAt,
      })),
      page,
      perPage,
      total,
    };
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
        daysSincePrevious: previous ? Math.round((date.getTime() - previous.getTime()) / 86_400_000) : null,
      };
    });
    const intervals = items.map((item) => item.daysSincePrevious).filter((days): days is number => days !== null);
    return {
      items,
      averageDays: intervals.length ? Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length) : null,
    };
  }

  private async authorizedSession(id: string, owner: CheckoutOwner, mutable = false): Promise<SessionRecord> {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (
      !session ||
      !((owner.customerId && session.customerId === owner.customerId) || (owner.tokenHash && session.accessTokenHash === owner.tokenHash))
    )
      throw new CheckoutNotFoundError();
    if (mutable && session.status !== 'DRAFT') throw new CheckoutConflictError('La sesión de checkout ya no admite modificaciones.');
    if (session.status === 'DRAFT' && session.expiresAt <= new Date())
      throw new CheckoutConflictError('La sesión de checkout expiró.', undefined, 'CHECKOUT_SESSION_EXPIRED_CONFLICT');
    return session;
  }

  private async resumeSession(value: SessionRecord, token: string) {
    if (value.status === 'COMPLETED') throw new CheckoutConflictError('El carrito ya fue convertido en pedido.');
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
    const [promotions, transfer, priorOrder] = await Promise.all([
      this.prisma.promotion.findMany({
        where: { active: true },
        include: { targets: true, bundleItems: true },
      }),
      this.paymentBenefits?.transfer() ?? Promise.resolve(null),
      findConfirmedPurchase(this.prisma, value.customerId, value.contactEmail),
    ]);
    const scheduledDiscount = scheduledDiscountForSession(value);
    const pricingWithoutShipping = calculateCheckoutPricing({
      lines: toPromotionLines(value),
      promotions: promotions.map(mapPromotion),
      coupon: value.coupon ? mapCoupon(value.coupon) : null,
      scheduledPurchase: scheduledPurchaseInput(value, scheduledDiscount),
      paymentMethod: value.paymentMethod,
      paymentBenefit: transfer
        ? {
            enabled: transfer.enabled,
            discountPercent: transfer.discountPercent,
          }
        : null,
    });
    const eligibleAmount = Math.max(0, Number(pricingWithoutShipping.subtotal) - Number(pricingWithoutShipping.productDiscountTotal));
    const threshold = value.shippingZone?.freeShippingFrom?.toString() ?? null;
    const thresholdReached = threshold !== null && eligibleAmount >= Number(threshold);
    const shippingBenefit =
      thresholdReached && Number(value.shippingCost) > 0
        ? {
            origin: 'FREE_SHIPPING_THRESHOLD',
            description: 'Envío gratis por monto mínimo',
            amount: value.shippingCost.toString(),
          }
        : !priorOrder && Number(value.shippingCost) > 0
          ? {
              origin: 'FIRST_ORDER_FREE_SHIPPING',
              description: 'Primer envío gratis',
              amount: value.shippingCost.toString(),
            }
          : null;
    return mapSession(value, promotions.map(mapPromotion), transfer, shippingBenefit);
  }
}

const validateReady = (session: SessionRecord) => {
  if (!session.contactName || !session.contactEmail || !session.shippingAddress || !session.shippingOptionId || !session.paymentMethod)
    throw new CheckoutValidationError('Completa datos, dirección, envío y pago antes de confirmar.');
};

const createOrderNumber = (): string => `PAT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

const recordStatusEvent = async (
  transaction: Prisma.TransactionClient,
  orderId: string,
  status: 'DRAFT' | 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
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
  transferConfiguration?: {
    enabled: boolean;
    discountPercent: string;
  } | null,
  shippingBenefit?: {
    origin: string;
    description: string;
    amount: string;
  } | null,
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
    availableQuantity: Math.max(0, (item.variant.inventory?.onHand ?? 0) - (item.variant.inventory?.reserved ?? 0)),
  }));
  const subtotal = items.reduce((sum: number, item: CartItem) => sum + Number(item.lineTotal), 0);
  const scheduledDiscount = scheduledDiscountForSession(value);
  const shipping = Number(value.shippingCost ?? 0);
  const pricing = calculateCheckoutPricing({
    lines: toPromotionLines(value),
    promotions,
    coupon: value.coupon ? mapCoupon(value.coupon) : null,
    scheduledPurchase: scheduledPurchaseInput(value, scheduledDiscount),
    paymentMethod: value.paymentMethod,
    paymentBenefit: transferConfiguration
      ? {
          enabled: transferConfiguration.enabled,
          discountPercent: transferConfiguration.discountPercent,
        }
      : null,
    shipping: { cost: shipping.toFixed(2), benefit: shippingBenefit },
  });
  const threshold = value.shippingZone?.freeShippingFrom?.toString() ?? null;
  const eligibleAmount = Math.max(0, Number(subtotal.toFixed(2)) - Number(pricing.productDiscountTotal));
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
    shippingCost: pricing.shippingCost,
    paymentMethod: value.paymentMethod,
    savedPaymentMethodId: value.savedPaymentMethodId,
    couponCode: value.coupon?.code ?? null,
    orderId: value.orderId ?? null,
    subtotal: subtotal.toFixed(2),
    discountTotal: pricing.discountTotal,
    total: pricing.total,
    pricing: {
      productDiscountTotal: pricing.productDiscountTotal,
      paymentDiscountTotal: pricing.paymentDiscountTotal,
      shippingDiscountTotal: pricing.shippingDiscountTotal,
      benefits: pricing.benefits,
      conflicts: pricing.conflicts,
      shippingThreshold: {
        threshold,
        eligibleAmount: eligibleAmount.toFixed(2),
        remaining: threshold === null ? null : Math.max(0, Number(threshold) - eligibleAmount).toFixed(2),
      },
    },
    actions: pricing.actions,
    items,
    expiresAt: value.expiresAt,
    scheduledPurchase: value.purchaseSchedule
      ? {
          id: value.purchaseSchedule.id,
          frequencyDays: value.purchaseSchedule.frequencyDays,
          discountPercent: value.purchaseSchedule.discountPercent.toString(),
          leadDays: value.purchaseSchedule.leadDays,
          status: value.purchaseSchedule.status,
        }
      : null,
  };
};

const scheduledDiscountForSession = (value: {
  purchaseSchedule?: {
    status: string;
    variantId: string;
    quantity: number;
    discountPercent: Prisma.Decimal;
  } | null;
  cart: {
    items: Array<{
      variantId: string;
      quantity: number;
      variant: { salePrice: Prisma.Decimal | null };
    }>;
  };
}): number => {
  const schedule = value.purchaseSchedule;
  if (!schedule || !['DRAFT', 'PENDING_PAYMENT'].includes(schedule.status)) return 0;
  const item = value.cart.items.find((candidate) => candidate.variantId === schedule.variantId);
  if (!item) return 0;
  return Number(
    ((Number(item.variant.salePrice ?? 0) * Math.min(item.quantity, schedule.quantity) * Number(schedule.discountPercent)) / 100).toFixed(2),
  );
};

const scheduledPurchaseInput = (
  value: {
    purchaseSchedule?: {
      id: string;
      status: string;
      discountPercent: Prisma.Decimal;
    } | null;
  },
  amount: number,
) => {
  if (!value.purchaseSchedule) return null;
  if (!['DRAFT', 'PENDING_PAYMENT'].includes(value.purchaseSchedule.status)) return null;
  return {
    id: value.purchaseSchedule.id,
    discountPercent: value.purchaseSchedule.discountPercent.toString(),
    amount: Math.max(0, amount).toFixed(2),
  };
};

const addDays = (date: Date, days: number): Date => {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
};

const createPaymentFingerprint = (input: { orderId: string; amount: string; currency: string }): string =>
  createHash('sha256').update(JSON.stringify(input)).digest('hex');

const findConfirmedPurchase = async (client: PrismaService | Prisma.TransactionClient, customerId: string | null, contactEmail: string | null) => {
  const identity = [
    ...(customerId ? [{ customerId }] : []),
    ...(contactEmail
      ? [
          {
            contactEmail: {
              equals: contactEmail.trim().toLowerCase(),
              mode: 'insensitive' as const,
            },
          },
        ]
      : []),
  ];
  if (!identity.length) return null;
  return client.order.findFirst({
    where: {
      OR: identity,
      payments: { some: { kind: 'PAYMENT', paidAt: { not: null } } },
    },
    select: { id: true },
  });
};

const calculateCurrentShipping = async (
  transaction: Prisma.TransactionClient,
  session: SessionRecord,
  subtotal: number,
  deliveryDate?: string,
): Promise<{
  cost: string;
  providerCost: string;
  tariff: string;
  subsidy: string;
  deliveryCount: number;
  vat: string;
  deliverySlotId: string;
  deliveryDate: Date;
  zoneId: string | null;
  zoneName: string | null;
  estimate: string | null;
  deliverySlotLabel: string;
  freeShippingFrom: string | null;
  eligibleAmount: string;
  remainingForFreeShipping: string | null;
}> => {
  const option = await transaction.shippingOption.findFirst({
    where: { id: session.shippingOptionId ?? '__missing__', active: true },
  });
  if (!option) throw new CheckoutConflictError('La opción de envío ya no está disponible.');
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
    (total, item) => (total === undefined || item.variant.weightGrams === null ? undefined : total + item.variant.weightGrams * item.quantity),
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
        (item) => (item.variant.inventory?.onHand ?? 0) - (item.variant.inventory?.reserved ?? 0) >= item.quantity,
      ),
    },
    pricingRules?.subsidizedShippingCost?.toString() ?? '0.00',
  );
  if (!quote.available) throw new CheckoutConflictError(quote.message);
  const deliverySlot = selectDeliverySlot(
    quote.deliverySlots,
    session.shippingDeliverySlot ?? undefined,
    deliveryDate ?? (session.shippingDeliveryDate ? session.shippingDeliveryDate.toISOString().slice(0, 10) : undefined),
  );
  if (!deliverySlot)
    throw new CheckoutConflictError(
      'La fecha de entrega seleccionada ya no está disponible. Elegí otra.',
      undefined,
      'DELIVERY_DATE_UNAVAILABLE_CONFLICT',
    );
  return {
    ...quote,
    deliverySlotId: deliverySlot.id,
    deliverySlotLabel: deliverySlot.label,
    deliveryDate: new Date(`${deliverySlot.date}T00:00:00.000Z`),
  };
};

const selectDeliverySlot = (slots: ShippingDeliverySlot[], id?: string, date?: string): ShippingDeliverySlot | null =>
  slots.find((slot) => slot.id === (id ?? slots[0]?.id) && (!date || slot.date === date)) ?? null;

const mapShippingZone = (value: Prisma.ShippingZoneGetPayload<Prisma.ShippingZoneDefaultArgs>): ShippingZone => ({
  id: value.id,
  name: value.name,
  type: value.type,
  region: value.region,
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

const mapOrder = (value: Prisma.OrderGetPayload<{ include: typeof orderInclude }>): OrderSummary => ({
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
  benefits: value.benefits.map((benefit) => ({
    id: benefit.id,
    type: benefit.type,
    scope: benefit.scope,
    origin: benefit.origin,
    sourceId: benefit.sourceId,
    sourceCode: benefit.sourceCode,
    description: benefit.description,
    percentage: benefit.percentage?.toString() ?? null,
    amount: benefit.amount.toString(),
    currency: benefit.currency,
    metadata: benefit.metadata,
    createdAt: benefit.createdAt,
  })),
  createdAt: value.createdAt,
});
