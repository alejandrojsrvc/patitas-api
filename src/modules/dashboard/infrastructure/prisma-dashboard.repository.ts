import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import type { PricingRules } from '../../pricing/domain/pricing.types';
import type {
  DashboardAlert,
  DashboardRepository,
  DashboardSummary,
} from '../domain/dashboard.types';

type DashboardVariant = Prisma.ProductVariantGetPayload<{
  include: { product: true; preferredSupplierOffer: true };
}>;

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async summary(rules: PricingRules | null): Promise<DashboardSummary> {
    const where: Prisma.ProductVariantWhereInput = {
      active: true,
      product: { status: 'ACTIVE' },
    };
    const [activeProducts, variants, pendingPricingReviews] =
      await this.prisma.$transaction([
        this.prisma.product.count({ where: { status: 'ACTIVE' } }),
        this.prisma.productVariant.findMany({
          where,
          include: { product: true, preferredSupplierOffer: true },
        }),
        this.prisma.pricingReview.count({ where: { status: 'PENDING' } }),
      ]);
    const withoutPrice = variants.filter(
      (variant) => !variant.salePrice || Number(variant.salePrice) <= 0,
    ).length;
    const withoutSupplier = variants.filter(
      (variant) =>
        !variant.preferredSupplierOfferId ||
        !variant.preferredSupplierOffer?.active,
    ).length;
    const margins = variants
      .map((variant) => currentMargin(variant, rules))
      .filter((value): value is number => value !== null);
    const alerts = variants.flatMap((variant) =>
      lowMarginAlert(variant, rules),
    );
    return {
      activeProducts,
      variantsWithoutPrice: withoutPrice,
      pendingPricingReviews,
      variantsWithoutSupplier: withoutSupplier,
      averageMarginPercent: margins.length
        ? Number(
            (
              margins.reduce((sum, value) => sum + value, 0) / margins.length
            ).toFixed(2),
          )
        : null,
      alerts,
    };
  }
}

const currentMargin = (
  variant: DashboardVariant,
  rules: PricingRules | null,
): number | null => {
  const price = Number(variant.salePrice);
  const offer = variant.preferredSupplierOffer;
  if (
    !rules ||
    !offer?.active ||
    !variant.salePrice ||
    price <= 0 ||
    [
      rules.fulfillmentCost,
      rules.packagingCost,
      rules.paymentFixedCost,
      rules.paymentFeePercent,
      rules.subsidizedShippingCost,
      rules.taxPercent,
      rules.otherCost,
    ].some((value) => value === null)
  )
    return null;
  const fixed =
    Number(offer.unitCost) +
    Number(rules.fulfillmentCost) +
    Number(rules.packagingCost) +
    Number(rules.paymentFixedCost) +
    Number(rules.subsidizedShippingCost) +
    Number(rules.otherCost);
  const effectiveCost =
    fixed +
    (price * Number(rules.paymentFeePercent)) / 100 +
    (price * Number(rules.taxPercent)) / 100;
  return ((price - effectiveCost) / price) * 100;
};

const lowMarginAlert = (
  variant: DashboardVariant,
  rules: PricingRules | null,
): DashboardAlert[] => {
  const margin = currentMargin(variant, rules);
  const target = rules?.targetMarginPercent
    ? Number(rules.targetMarginPercent)
    : null;
  return margin !== null && target !== null && margin < target
    ? [
        {
          type: 'LOW_MARGIN',
          productId: variant.productId,
          variantId: variant.id,
          label: `${variant.product.name} · ${variant.presentation ?? variant.sku ?? variant.id}`,
          currentMargin: Number(margin.toFixed(2)),
          targetMargin: target,
        },
      ]
    : [];
};
