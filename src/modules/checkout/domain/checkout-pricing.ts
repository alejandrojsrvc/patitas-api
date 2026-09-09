import { calculateDiscount } from '../../promotions/domain/promotion-calculator';
import type { Coupon, Promotion, PromotionLine } from '../../promotions/domain/promotion.types';

export type CheckoutBenefitType = 'SCHEDULED_PURCHASE' | 'COUPON' | 'AUTOMATIC_PROMOTION' | 'PAYMENT_METHOD' | 'SHIPPING' | 'CUSTOMER_CREDIT';

export type CheckoutBenefitScope = 'PRODUCT' | 'ORDER' | 'PAYMENT' | 'SHIPPING';

export interface CheckoutBenefit {
  type: CheckoutBenefitType;
  scope: CheckoutBenefitScope;
  origin: string;
  sourceId: string | null;
  sourceCode: string | null;
  description: string;
  percentage: string | null;
  amount: string;
}

export interface CheckoutPricingConflict {
  code:
    | 'COUPON_INCOMPATIBLE_WITH_SCHEDULED_PURCHASE'
    | 'AUTOMATIC_PROMOTION_SUPPRESSED_BY_SCHEDULED_PURCHASE'
    | 'AUTOMATIC_PROMOTION_SUPPRESSED_BY_COUPON';
  benefitType: CheckoutBenefitType;
  sourceId: string | null;
  sourceCode: string | null;
  message: string;
}

export interface CheckoutPricingActions {
  coupon: {
    allowed: boolean;
    reasonCode: CheckoutPricingConflict['code'] | null;
    message: string | null;
  };
  purchaseSchedule: {
    allowed: boolean;
    reasonCode: CheckoutPricingConflict['code'] | null;
    message: string | null;
  };
}

export interface CheckoutPricingInput {
  lines: PromotionLine[];
  promotions: Promotion[];
  coupon?: Coupon | null;
  scheduledPurchase?: {
    id: string;
    discountPercent: string;
    amount: string;
  } | null;
  paymentMethod?: string | null;
  paymentBenefit?: {
    enabled: boolean;
    discountPercent: string;
  } | null;
  shipping?: {
    cost: string;
    benefit?: {
      origin: string;
      sourceId?: string | null;
      description: string;
      amount: string;
    } | null;
  };
}

export interface CheckoutPricingResult {
  subtotal: string;
  productDiscountTotal: string;
  paymentDiscountTotal: string;
  shippingDiscountTotal: string;
  discountTotal: string;
  shippingCost: string;
  total: string;
  benefits: CheckoutBenefit[];
  conflicts: CheckoutPricingConflict[];
  actions: CheckoutPricingActions;
}

export const calculateCheckoutPricing = (input: CheckoutPricingInput): CheckoutPricingResult => {
  const subtotal = money(input.lines.reduce((sum, line) => sum + Number(line.unitPrice) * line.quantity, 0));
  const automatic = calculateDiscount(input.lines, input.promotions, null);
  const coupon = input.coupon ? calculateDiscount(input.lines, input.promotions, input.coupon) : null;
  const conflicts: CheckoutPricingConflict[] = [];
  const benefits: CheckoutBenefit[] = [];
  const hasSchedule = Boolean(input.scheduledPurchase);
  const hasCoupon = Boolean(input.coupon);
  const configuredCoupon = input.coupon;

  if (hasSchedule && hasCoupon) {
    conflicts.push({
      code: 'COUPON_INCOMPATIBLE_WITH_SCHEDULED_PURCHASE',
      benefitType: 'COUPON',
      sourceId: input.coupon?.id ?? null,
      sourceCode: input.coupon?.code ?? null,
      message: 'Los cupones no son acumulables con la compra programada.',
    });
  }

  if (hasSchedule && Number(automatic.discountTotal) > 0) {
    conflicts.push({
      code: 'AUTOMATIC_PROMOTION_SUPPRESSED_BY_SCHEDULED_PURCHASE',
      benefitType: 'AUTOMATIC_PROMOTION',
      sourceId: automatic.promotionId,
      sourceCode: null,
      message: 'La promoción automática no es acumulable con la compra programada.',
    });
  } else if (!hasSchedule && hasCoupon && Number(automatic.discountTotal) > 0) {
    conflicts.push({
      code: 'AUTOMATIC_PROMOTION_SUPPRESSED_BY_COUPON',
      benefitType: 'AUTOMATIC_PROMOTION',
      sourceId: automatic.promotionId,
      sourceCode: null,
      message: 'La promoción automática no es acumulable con un cupón.',
    });
  }

  const productDiscount = hasSchedule ? Number(input.scheduledPurchase?.amount ?? 0) : Number(coupon?.discountTotal ?? automatic.discountTotal);

  if (input.scheduledPurchase && productDiscount > 0) {
    benefits.push({
      type: 'SCHEDULED_PURCHASE',
      scope: 'PRODUCT',
      origin: 'PURCHASE_SCHEDULE',
      sourceId: input.scheduledPurchase.id,
      sourceCode: null,
      description: 'Descuento por compra programada',
      percentage: input.scheduledPurchase.discountPercent,
      amount: money(productDiscount),
    });
  } else if (configuredCoupon && Number(coupon?.discountTotal ?? 0) > 0) {
    benefits.push({
      type: 'COUPON',
      scope: 'PRODUCT',
      origin: 'COUPON',
      sourceId: configuredCoupon.id,
      sourceCode: configuredCoupon.code,
      description: configuredCoupon.promotion.name,
      percentage: configuredCoupon.promotion.type === 'PERCENTAGE' ? configuredCoupon.promotion.value : null,
      amount: money(productDiscount),
    });
  } else if (!hasSchedule && automatic.promotionId && Number(automatic.discountTotal) > 0) {
    const promotion = input.promotions.find((candidate) => candidate.id === automatic.promotionId);
    benefits.push({
      type: 'AUTOMATIC_PROMOTION',
      scope: 'PRODUCT',
      origin: 'AUTOMATIC_PROMOTION',
      sourceId: automatic.promotionId,
      sourceCode: null,
      description: promotion?.name ?? 'Promoción automática',
      percentage: promotion?.type === 'PERCENTAGE' ? promotion.value : null,
      amount: money(productDiscount),
    });
  }

  const netProducts = Math.max(0, Number(subtotal) - productDiscount);
  const paymentDiscount =
    input.paymentMethod === 'BANK_TRANSFER' && input.paymentBenefit?.enabled ? (netProducts * Number(input.paymentBenefit.discountPercent)) / 100 : 0;
  if (paymentDiscount > 0) {
    benefits.push({
      type: 'PAYMENT_METHOD',
      scope: 'PAYMENT',
      origin: 'PAYMENT_METHOD',
      sourceId: null,
      sourceCode: input.paymentMethod ?? null,
      description: 'Descuento por transferencia',
      percentage: input.paymentBenefit?.discountPercent ?? null,
      amount: money(paymentDiscount),
    });
  }

  const shippingBase = Number(input.shipping?.cost ?? 0);
  const shippingBenefit = input.shipping?.benefit;
  const shippingDiscount = Math.min(shippingBase, Math.max(0, Number(shippingBenefit?.amount ?? 0)));
  if (shippingBenefit && shippingDiscount > 0) {
    benefits.push({
      type: 'SHIPPING',
      scope: 'SHIPPING',
      origin: shippingBenefit.origin,
      sourceId: shippingBenefit.sourceId ?? null,
      sourceCode: null,
      description: shippingBenefit.description,
      percentage: null,
      amount: money(shippingDiscount),
    });
  }

  const productTotal = money(productDiscount);
  const paymentTotal = money(paymentDiscount);
  const shippingTotal = money(shippingDiscount);
  const discountTotal = money(Number(productTotal) + Number(paymentTotal) + Number(shippingTotal));
  const shippingCost = money(shippingBase - Number(shippingTotal));

  return {
    subtotal,
    productDiscountTotal: productTotal,
    paymentDiscountTotal: paymentTotal,
    shippingDiscountTotal: shippingTotal,
    discountTotal,
    shippingCost,
    total: money(Math.max(0, Number(subtotal) - Number(productTotal) - Number(paymentTotal) + Number(shippingCost))),
    benefits,
    conflicts,
    actions: {
      coupon: {
        allowed: !hasSchedule,
        reasonCode: hasSchedule ? 'COUPON_INCOMPATIBLE_WITH_SCHEDULED_PURCHASE' : null,
        message: hasSchedule ? 'Los cupones no son acumulables con la compra programada.' : null,
      },
      purchaseSchedule: {
        allowed: !hasCoupon,
        reasonCode: hasCoupon ? 'COUPON_INCOMPATIBLE_WITH_SCHEDULED_PURCHASE' : null,
        message: hasCoupon ? 'El cupón aplicado no es acumulable con la compra programada.' : null,
      },
    },
  };
};

const money = (value: number): string => Math.max(0, Number.isFinite(value) ? value : 0).toFixed(2);
