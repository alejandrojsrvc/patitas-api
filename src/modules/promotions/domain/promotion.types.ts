export type PromotionType = 'PERCENTAGE' | 'FIXED';
export type PromotionKind = 'DISCOUNT' | 'BUNDLE';

export interface PromotionTargetInput {
  productId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
}

export interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  kind: PromotionKind;
  value: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  minimumSubtotal: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  targets: PromotionTargetInput[];
  bundleItems: Array<{ variantId: string; quantity: number }>;
}

export interface PromotionInput {
  name: string;
  type: PromotionType;
  kind?: PromotionKind;
  value: string;
  active?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  priority?: number;
  minimumSubtotal?: string | null;
  maxRedemptions?: number | null;
  targets?: PromotionTargetInput[];
  bundleItems?: Array<{ variantId: string; quantity: number }>;
}

export interface Coupon {
  id: string;
  promotionId: string;
  code: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  perCustomerLimit: number | null;
  promotion: Promotion;
}

export interface CouponInput {
  promotionId: string;
  code: string;
  active?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxRedemptions?: number | null;
  perCustomerLimit?: number | null;
}

export interface PromotionLine {
  variantId: string;
  productId: string;
  categoryId: string | null;
  brandId: string;
  quantity: number;
  unitPrice: string;
}

export interface DiscountResult {
  discountTotal: string;
  couponCode: string | null;
  promotionId: string | null;
}
