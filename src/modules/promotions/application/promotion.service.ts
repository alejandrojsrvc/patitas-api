import {
  PromotionNotFoundError,
  PromotionValidationError,
} from '../domain/promotion.error';
import type { PromotionRepository } from '../domain/promotion.repository';
import type { CouponInput, PromotionInput } from '../domain/promotion.types';

export class PromotionService {
  public constructor(private readonly repository: PromotionRepository) {}

  public list(activeOnly = false) {
    return this.repository.list(activeOnly);
  }
  public listCoupons() {
    return this.repository.listCoupons();
  }
  public create(input: PromotionInput) {
    validatePromotion(input);
    return this.repository.create(normalizePromotion(input));
  }
  public async update(id: string, input: Partial<PromotionInput>) {
    const current = await this.find(id);
    validatePromotion({ ...current, ...input });
    const maxRedemptions =
      input.maxRedemptions !== undefined
        ? input.maxRedemptions
        : current.maxRedemptions;
    if (
      maxRedemptions !== null &&
      maxRedemptions !== undefined &&
      current.redemptionCount > maxRedemptions
    )
      throw new PromotionValidationError(
        'El límite de la promoción no puede ser menor a los usos ya registrados.',
      );
    return this.repository.update(id, normalizePromotion(input));
  }
  public async find(id: string) {
    const promotion = await this.repository.findById(id);
    if (!promotion) throw new PromotionNotFoundError();
    return promotion;
  }
  public createCoupon(input: CouponInput) {
    const normalized: CouponInput = {
      ...input,
      code: input.code.trim().toUpperCase(),
    };
    validateCoupon(normalized);
    return this.ensurePromotion(normalized.promotionId).then(() =>
      this.repository.createCoupon(normalized),
    );
  }
  public async updateCoupon(id: string, input: Partial<CouponInput>) {
    const current = await this.repository.findCouponById(id);
    if (!current) throw new PromotionNotFoundError('El cupón no existe.');
    const merged: CouponInput = {
      promotionId: input.promotionId ?? current.promotionId,
      code: (input.code ?? current.code).trim().toUpperCase(),
      active: input.active ?? current.active,
      startsAt:
        input.startsAt !== undefined ? input.startsAt : current.startsAt,
      endsAt: input.endsAt !== undefined ? input.endsAt : current.endsAt,
      maxRedemptions:
        input.maxRedemptions !== undefined
          ? input.maxRedemptions
          : current.maxRedemptions,
      perCustomerLimit:
        input.perCustomerLimit !== undefined
          ? input.perCustomerLimit
          : current.perCustomerLimit,
    };
    validateCoupon(merged);
    if (
      merged.maxRedemptions !== null &&
      merged.maxRedemptions !== undefined &&
      current.redemptionCount > merged.maxRedemptions
    )
      throw new PromotionValidationError(
        'El límite del cupón no puede ser menor a los usos ya registrados.',
      );
    if (merged.promotionId !== current.promotionId)
      await this.ensurePromotion(merged.promotionId);
    return this.repository.updateCoupon(id, {
      ...input,
      ...(input.code !== undefined ? { code: merged.code } : {}),
    });
  }

  public async validateCoupon(code: string) {
    const coupon = await this.repository.findCoupon(code.trim().toUpperCase());
    if (
      !coupon ||
      !coupon.active ||
      !isWithinPeriod(coupon.startsAt, coupon.endsAt) ||
      (coupon.maxRedemptions !== null &&
        coupon.redemptionCount >= coupon.maxRedemptions) ||
      (coupon.promotion.maxRedemptions !== null &&
        coupon.promotion.redemptionCount >= coupon.promotion.maxRedemptions)
    ) {
      throw new PromotionValidationError(
        'El cupón no es válido o ya no está disponible.',
      );
    }
    return coupon;
  }

  private async ensurePromotion(id: string): Promise<void> {
    if (!(await this.repository.findById(id)))
      throw new PromotionNotFoundError('La promoción no existe.');
  }
}

const validatePromotion = (input: Partial<PromotionInput>) => {
  if (input.name !== undefined && !input.name.trim())
    throw new PromotionValidationError(
      'El nombre de la promoción es obligatorio.',
    );
  if (
    input.value !== undefined &&
    (!/^\d+(\.\d{1,2})?$/.test(input.value) || Number(input.value) < 0)
  )
    throw new PromotionValidationError(
      'El valor de la promoción no es válido.',
    );
  if (
    input.type === 'PERCENTAGE' &&
    input.value !== undefined &&
    Number(input.value) > 100
  )
    throw new PromotionValidationError('El porcentaje no puede superar 100.');
  if (
    input.minimumSubtotal !== undefined &&
    input.minimumSubtotal !== null &&
    (!/^(\d+)(\.\d{1,2})?$/.test(input.minimumSubtotal) ||
      Number(input.minimumSubtotal) < 0)
  )
    throw new PromotionValidationError(
      'El subtotal mínimo de la promoción no es válido.',
    );
  if (
    input.maxRedemptions !== undefined &&
    input.maxRedemptions !== null &&
    (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions < 1)
  )
    throw new PromotionValidationError(
      'El límite de usos de la promoción no es válido.',
    );
  if (
    input.priority !== undefined &&
    (!Number.isInteger(input.priority) || input.priority < 0)
  )
    throw new PromotionValidationError(
      'La prioridad de la promoción no es válida.',
    );
  validateDateRange(input.startsAt, input.endsAt);
  if (
    input.targets?.some(
      (target) =>
        !target.productId &&
        !target.variantId &&
        !target.categoryId &&
        !target.brandId,
    )
  ) {
    throw new PromotionValidationError(
      'Cada objetivo de promoción debe apuntar a un producto, variante, categoría o marca.',
    );
  }
  if (
    input.kind === 'BUNDLE' &&
    (!input.bundleItems?.length ||
      input.bundleItems.some((item) => !item.variantId || item.quantity < 1))
  )
    throw new PromotionValidationError(
      'Un combo debe tener variantes y cantidades válidas.',
    );
  if (
    input.bundleItems &&
    new Set(input.bundleItems.map((item) => item.variantId)).size !==
      input.bundleItems.length
  )
    throw new PromotionValidationError('Un combo no puede repetir variantes.');
};

const validateCoupon = (input: Partial<CouponInput>) => {
  if (
    input.code !== undefined &&
    !/^[A-Z0-9][A-Z0-9_-]{2,79}$/.test(input.code.trim().toUpperCase())
  )
    throw new PromotionValidationError(
      'El código debe tener entre 3 y 80 caracteres alfanuméricos, guion o guion bajo.',
    );
  if (input.promotionId !== undefined && !input.promotionId)
    throw new PromotionValidationError(
      'La promoción del cupón es obligatoria.',
    );
  if (
    input.maxRedemptions !== undefined &&
    input.maxRedemptions !== null &&
    (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions < 1)
  )
    throw new PromotionValidationError(
      'El límite de usos del cupón no es válido.',
    );
  if (
    input.perCustomerLimit !== undefined &&
    input.perCustomerLimit !== null &&
    (!Number.isInteger(input.perCustomerLimit) || input.perCustomerLimit < 1)
  )
    throw new PromotionValidationError(
      'El límite por cliente del cupón no es válido.',
    );
  validateDateRange(input.startsAt, input.endsAt);
};

const validateDateRange = (
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
) => {
  if (startsAt && endsAt && startsAt > endsAt)
    throw new PromotionValidationError(
      'La fecha de inicio no puede ser posterior a la fecha de fin.',
    );
};

const normalizePromotion = <T extends PromotionInput | Partial<PromotionInput>>(
  input: T,
): T => ({
  ...input,
  ...(input.name !== undefined ? { name: input.name.trim() } : {}),
});

export const isWithinPeriod = (
  startsAt: Date | null,
  endsAt: Date | null,
  now = new Date(),
) => (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
