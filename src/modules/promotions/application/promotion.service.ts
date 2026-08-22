import { PromotionNotFoundError, PromotionValidationError } from '../domain/promotion.error';
import type { PromotionRepository } from '../domain/promotion.repository';
import type { CouponInput, PromotionInput } from '../domain/promotion.types';

export class PromotionService {
  public constructor(private readonly repository: PromotionRepository) {}

  public list(activeOnly = false) { return this.repository.list(activeOnly); }
  public listCoupons() { return this.repository.listCoupons(); }
  public create(input: PromotionInput) { validatePromotion(input); return this.repository.create(normalizePromotion(input)); }
  public async update(id: string, input: Partial<PromotionInput>) {
    const current = await this.find(id);
    validatePromotion({ ...current, ...input });
    return this.repository.update(id, normalizePromotion(input));
  }
  public async find(id: string) { const promotion = await this.repository.findById(id); if (!promotion) throw new PromotionNotFoundError(); return promotion; }
  public createCoupon(input: CouponInput) { validateCoupon(input); return this.repository.createCoupon({ ...input, code: input.code.trim().toUpperCase() }); }
  public async updateCoupon(id: string, input: Partial<CouponInput>) { validateCoupon(input); return this.repository.updateCoupon(id, { ...input, ...(input.code ? { code: input.code.trim().toUpperCase() } : {}) }); }

  public async validateCoupon(code: string) {
    const coupon = await this.repository.findCoupon(code.trim().toUpperCase());
    if (!coupon || !coupon.active || !isWithinPeriod(coupon.startsAt, coupon.endsAt) || (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) || (coupon.promotion.maxRedemptions !== null && coupon.promotion.redemptionCount >= coupon.promotion.maxRedemptions)) {
      throw new PromotionValidationError('El cupón no es válido o ya no está disponible.');
    }
    return coupon;
  }
}

const validatePromotion = (input: Partial<PromotionInput>) => {
  if (input.name !== undefined && !input.name.trim()) throw new PromotionValidationError('El nombre de la promoción es obligatorio.');
  if (input.value !== undefined && (!/^\d+(\.\d{1,2})?$/.test(input.value) || Number(input.value) < 0)) throw new PromotionValidationError('El valor de la promoción no es válido.');
  if (input.type === 'PERCENTAGE' && input.value !== undefined && Number(input.value) > 100) throw new PromotionValidationError('El porcentaje no puede superar 100.');
  if (input.targets?.some((target) => !target.productId && !target.variantId && !target.categoryId && !target.brandId)) {
    throw new PromotionValidationError('Cada objetivo de promoción debe apuntar a un producto, variante, categoría o marca.');
  }
  if (input.kind === 'BUNDLE' && (!input.bundleItems?.length || input.bundleItems.some((item) => !item.variantId || item.quantity < 1))) throw new PromotionValidationError('Un combo debe tener variantes y cantidades válidas.');
};

const validateCoupon = (input: Partial<CouponInput>) => {
  if (input.code !== undefined && !input.code.trim()) throw new PromotionValidationError('El código del cupón es obligatorio.');
  if (input.promotionId !== undefined && !input.promotionId) throw new PromotionValidationError('La promoción del cupón es obligatoria.');
};

const normalizePromotion = <T extends PromotionInput | Partial<PromotionInput>>(input: T): T => ({
  ...input,
  ...(input.name !== undefined ? { name: input.name.trim() } : {}),
}) as T;

export const isWithinPeriod = (startsAt: Date | null, endsAt: Date | null, now = new Date()) =>
  (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
