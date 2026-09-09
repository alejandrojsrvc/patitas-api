import { calculateCheckoutPricing } from '../../../src/modules/checkout/domain/checkout-pricing';
import type { Promotion, PromotionLine } from '../../../src/modules/promotions/domain/promotion.types';

const lines: PromotionLine[] = [
  {
    variantId: 'variant-1',
    productId: 'product-1',
    categoryId: 'category-1',
    brandId: 'brand-1',
    quantity: 1,
    unitPrice: '50000.00',
  },
];

const promotion: Promotion = {
  id: 'promotion-1',
  name: 'Promo automática',
  type: 'PERCENTAGE',
  kind: 'DISCOUNT',
  value: '20.00',
  active: true,
  startsAt: null,
  endsAt: null,
  priority: 1,
  minimumSubtotal: null,
  maxRedemptions: null,
  redemptionCount: 0,
  targets: [{ productId: 'product-1' }],
  bundleItems: [],
};

describe('calculateCheckoutPricing', () => {
  it('prioritizes scheduled purchase and reports suppressed automatic promotion', () => {
    const result = calculateCheckoutPricing({
      lines,
      promotions: [promotion],
      scheduledPurchase: {
        id: 'schedule-1',
        discountPercent: '10.00',
        amount: '5000.00',
      },
    });

    expect(result.productDiscountTotal).toBe('5000.00');
    expect(result.benefits.map((benefit) => benefit.type)).toEqual(['SCHEDULED_PURCHASE']);
    expect(result.conflicts[0]).toMatchObject({
      code: 'AUTOMATIC_PROMOTION_SUPPRESSED_BY_SCHEDULED_PURCHASE',
    });
  });

  it('accumulates transfer and independent free shipping over product discount', () => {
    const result = calculateCheckoutPricing({
      lines,
      promotions: [],
      scheduledPurchase: {
        id: 'schedule-1',
        discountPercent: '10.00',
        amount: '5000.00',
      },
      paymentMethod: 'BANK_TRANSFER',
      paymentBenefit: { enabled: true, discountPercent: '3.00' },
      shipping: {
        cost: '4500.00',
        benefit: {
          origin: 'FIRST_ORDER_FREE_SHIPPING',
          description: 'Primer envío gratis',
          amount: '4500.00',
        },
      },
    });

    expect(result.paymentDiscountTotal).toBe('1350.00');
    expect(result.shippingDiscountTotal).toBe('4500.00');
    expect(result.shippingCost).toBe('0.00');
    expect(result.total).toBe('43650.00');
  });

  it('exposes that a coupon cannot be applied with scheduled purchase', () => {
    const coupon = {
      id: 'coupon-1',
      promotionId: promotion.id,
      code: 'SAVE20',
      active: true,
      startsAt: null,
      endsAt: null,
      maxRedemptions: null,
      redemptionCount: 0,
      perCustomerLimit: null,
      promotion,
    };
    const result = calculateCheckoutPricing({
      lines,
      promotions: [promotion],
      coupon,
      scheduledPurchase: {
        id: 'schedule-1',
        discountPercent: '10.00',
        amount: '5000.00',
      },
    });

    expect(result.actions.coupon).toMatchObject({
      allowed: false,
      reasonCode: 'COUPON_INCOMPATIBLE_WITH_SCHEDULED_PURCHASE',
    });
    expect(result.productDiscountTotal).toBe('5000.00');
  });
});
