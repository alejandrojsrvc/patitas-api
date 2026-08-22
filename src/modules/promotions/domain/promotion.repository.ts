import type {
  Coupon,
  CouponInput,
  Promotion,
  PromotionInput,
} from './promotion.types';

export const PROMOTION_REPOSITORY = Symbol('PROMOTION_REPOSITORY');

export interface PromotionRepository {
  list(activeOnly?: boolean): Promise<Promotion[]>;
  findById(id: string): Promise<Promotion | null>;
  create(input: PromotionInput): Promise<Promotion>;
  update(id: string, input: Partial<PromotionInput>): Promise<Promotion>;
  listCoupons(): Promise<Coupon[]>;
  findCoupon(code: string): Promise<Coupon | null>;
  createCoupon(input: CouponInput): Promise<Coupon>;
  updateCoupon(id: string, input: Partial<CouponInput>): Promise<Coupon>;
}
