import type {
  Coupon,
  DiscountResult,
  Promotion,
  PromotionLine,
} from './promotion.types';

export const calculateDiscount = (
  lines: PromotionLine[],
  promotions: Promotion[],
  coupon?: Coupon | null,
): DiscountResult => {
  const subtotal = lines.reduce(
    (sum, line) => sum + Number(line.unitPrice) * line.quantity,
    0,
  );
  const couponAvailable =
    !coupon ||
    (coupon.active &&
      isWithinPeriod(coupon.startsAt, coupon.endsAt) &&
      (coupon.maxRedemptions === null ||
        coupon.redemptionCount < coupon.maxRedemptions));
  const candidates = (coupon ? [coupon.promotion] : promotions).filter(
    (promotion) =>
      couponAvailable &&
      promotion.active &&
      isWithinPeriod(promotion.startsAt, promotion.endsAt) &&
      (promotion.maxRedemptions === null ||
        promotion.redemptionCount < promotion.maxRedemptions),
  );
  const eligible = candidates.filter((promotion) => {
    if (
      promotion.minimumSubtotal &&
      subtotal < Number(promotion.minimumSubtotal)
    )
      return false;
    return lines.some((line) => matchesTarget(promotion, line));
  });
  const promotion = eligible.sort(
    (left, right) => right.priority - left.priority,
  )[0];
  if (!promotion)
    return { discountTotal: '0.00', couponCode: null, promotionId: null };
  const affectedSubtotal = lines.reduce(
    (sum, line) =>
      sum +
      (matchesTarget(promotion, line)
        ? Number(line.unitPrice) * line.quantity
        : 0),
    0,
  );
  if (promotion.kind === 'BUNDLE' && promotion.bundleItems.length) {
    const complete = promotion.bundleItems.every(
      (item) =>
        (lines.find((line) => line.variantId === item.variantId)?.quantity ??
          0) >= item.quantity,
    );
    if (!complete)
      return { discountTotal: '0.00', couponCode: null, promotionId: null };
    const bundleSubtotal = promotion.bundleItems.reduce((sum, item) => {
      const line = lines.find(
        (candidate) => candidate.variantId === item.variantId,
      );
      return sum + (line ? Number(line.unitPrice) * item.quantity : 0);
    }, 0);
    return {
      discountTotal: Math.max(
        0,
        bundleSubtotal - Number(promotion.value),
      ).toFixed(2),
      couponCode: coupon?.code ?? null,
      promotionId: promotion.id,
    };
  }
  const discount =
    promotion.type === 'PERCENTAGE'
      ? (affectedSubtotal * Number(promotion.value)) / 100
      : Math.min(affectedSubtotal, Number(promotion.value));
  return {
    discountTotal: Math.max(0, discount).toFixed(2),
    couponCode: coupon?.code ?? null,
    promotionId: promotion.id,
  };
};

const matchesTarget = (promotion: Promotion, line: PromotionLine): boolean => {
  if (!promotion.targets.length) return true;
  return promotion.targets.some(
    (target) =>
      (target.variantId && target.variantId === line.variantId) ||
      (target.productId && target.productId === line.productId) ||
      (target.categoryId && target.categoryId === line.categoryId) ||
      (target.brandId && target.brandId === line.brandId),
  );
};

const isWithinPeriod = (
  startsAt: Date | null,
  endsAt: Date | null,
  now = new Date(),
) => (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
