import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type { Prisma } from '../../../../infrastructure/database/generated/prisma/client';
import {
  PricingNotFoundError, PricingPreconditionError, StalePricingReviewError,
} from '../../domain/errors/pricing.error';
import type { PricingRepository } from '../../domain/repositories/pricing.repository';
import type {
  PricingCalculation, PricingContext, PricingReview, PricingRules, PricingRuleValues,
} from '../../domain/pricing.types';

interface DecimalValue { toString(): string }
interface PersistenceRules {
  id: string; version: number; status: string; currency: string;
  fulfillmentCost: DecimalValue | null; packagingCost: DecimalValue | null;
  paymentFixedCost: DecimalValue | null; paymentFeePercent: DecimalValue | null;
  subsidizedShippingCost: DecimalValue | null; taxPercent: DecimalValue | null;
  otherCost: DecimalValue | null; targetMarginPercent: DecimalValue | null;
}
interface PersistenceReview {
  id: string; variantId: string; supplierOfferId: string; pricingRuleSetId: string;
  status: string; inputSnapshot: unknown; breakdown: unknown; recommendedPrice: DecimalValue;
  commercialPrice: DecimalValue; createdAt: Date; appliedAt: Date | null;
}

@Injectable()
export class PrismaPricingRepository implements PricingRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async getRules() {
    const [active, draft] = await Promise.all([
      this.prisma.pricingRuleSet.findFirst({ where: { status: 'ACTIVE' }, orderBy: { version: 'desc' } }),
      this.prisma.pricingRuleSet.findFirst({ where: { status: 'DRAFT' }, orderBy: { version: 'desc' } }),
    ]);
    return { active: active ? mapRules(active) : null, draft: draft ? mapRules(draft) : null };
  }

  public async listRuleHistory(): Promise<PricingRules[]> {
    const rules = await this.prisma.pricingRuleSet.findMany({
      orderBy: { version: 'desc' },
    });
    return rules.map(mapRules);
  }

  public async updateDraft(input: Partial<PricingRuleValues>): Promise<PricingRules> {
    return this.prisma.$transaction(async (transaction) => {
      const draft = await transaction.pricingRuleSet.findFirst({
        where: { status: 'DRAFT' }, orderBy: { version: 'desc' },
      });
      if (draft) {
        return mapRules(await transaction.pricingRuleSet.update({
          where: { id: draft.id }, data: input,
        }));
      }
      const latest = await transaction.pricingRuleSet.findFirst({ orderBy: { version: 'desc' } });
      const inherited = latest ? {
        currency: latest.currency,
        fulfillmentCost: latest.fulfillmentCost,
        packagingCost: latest.packagingCost,
        paymentFixedCost: latest.paymentFixedCost,
        paymentFeePercent: latest.paymentFeePercent,
        subsidizedShippingCost: latest.subsidizedShippingCost,
        taxPercent: latest.taxPercent,
        otherCost: latest.otherCost,
        targetMarginPercent: latest.targetMarginPercent,
      } : { currency: 'ARS' };
      return mapRules(await transaction.pricingRuleSet.create({
        data: { ...inherited, ...input, version: (latest?.version ?? 0) + 1, status: 'DRAFT' },
      }));
    });
  }

  public async activateDraft(): Promise<PricingRules> {
    return this.prisma.$transaction(async (transaction) => {
      const draft = await transaction.pricingRuleSet.findFirst({
        where: { status: 'DRAFT' }, orderBy: { version: 'desc' },
      });
      if (!draft) throw new PricingPreconditionError('No existe una configuración borrador.');
      await transaction.pricingRuleSet.updateMany({
        where: { status: 'ACTIVE' }, data: { status: 'SUPERSEDED' },
      });
      return mapRules(await transaction.pricingRuleSet.update({
        where: { id: draft.id }, data: { status: 'ACTIVE', activatedAt: new Date() },
      }));
    });
  }

  public async getContext(variantId: string, supplierOfferId?: string): Promise<PricingContext | null> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, revision: true, salePrice: true, preferredSupplierOfferId: true },
    });
    if (!variant) return null;
    const offerId = supplierOfferId ?? variant.preferredSupplierOfferId;
    if (!offerId) return null;
    const offer = await this.prisma.supplierOffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.variantId !== variant.id || !offer.active) return null;
    return {
      variantId: variant.id,
      variantRevision: variant.revision,
      currentSalePrice: variant.salePrice?.toString() ?? null,
      supplierOfferId: offer.id,
      supplierRevision: offer.revision,
      supplierUnitCost: offer.unitCost.toString(),
    };
  }

  public async saveReview(
    context: PricingContext,
    rules: PricingRules,
    effectiveRules: PricingRuleValues,
    calculation: PricingCalculation,
  ): Promise<PricingReview> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.pricingReview.updateMany({
        where: { variantId: context.variantId, status: 'PENDING' },
        data: { status: 'SUPERSEDED' },
      });
      const review = await transaction.pricingReview.create({
        data: {
          variantId: context.variantId,
          supplierOfferId: context.supplierOfferId,
          pricingRuleSetId: rules.id,
          variantRevision: context.variantRevision,
          supplierRevision: context.supplierRevision,
          inputSnapshot: {
            currentSalePrice: context.currentSalePrice,
            supplierUnitCost: context.supplierUnitCost,
            pricingRuleVersion: rules.version,
            effectiveRules,
          } as Prisma.InputJsonObject,
          breakdown: calculation.breakdown as unknown as Prisma.InputJsonObject,
          recommendedPrice: calculation.recommendedPrice,
          commercialPrice: calculation.commercialPrice,
        },
      });
      return mapReview(review);
    });
  }

  public async listReviews(variantId: string): Promise<PricingReview[]> {
    const reviews = await this.prisma.pricingReview.findMany({
      where: { variantId }, orderBy: { createdAt: 'desc' },
    });
    return reviews.map(mapReview);
  }

  public async listAllReviews(
    status?: PricingReview['status'],
  ): Promise<PricingReview[]> {
    const reviews = await this.prisma.pricingReview.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return reviews.map(mapReview);
  }

  public async applyReview(variantId: string, reviewId: string): Promise<PricingReview> {
    return this.prisma.$transaction(async (transaction) => {
      const review = await transaction.pricingReview.findUnique({
        where: { id: reviewId },
        include: { variant: true, supplierOffer: true, pricingRuleSet: true },
      });
      if (!review || review.variantId !== variantId) {
        throw new PricingNotFoundError('La revisión de precio no existe.');
      }
      const stale = review.status !== 'PENDING'
        || review.variant.revision !== review.variantRevision
        || review.supplierOffer.revision !== review.supplierRevision
        || review.pricingRuleSet.status !== 'ACTIVE'
        || review.variant.preferredSupplierOfferId !== review.supplierOfferId;
      if (stale) {
        throw new StalePricingReviewError(
          'La revisión quedó obsoleta; recalcula antes de aplicar el precio.',
        );
      }
      await transaction.productVariant.update({
        where: { id: variantId },
        data: { salePrice: review.commercialPrice, revision: { increment: 1 } },
      });
      const applied = await transaction.pricingReview.update({
        where: { id: review.id }, data: { status: 'APPLIED', appliedAt: new Date() },
      });
      await transaction.pricingReview.updateMany({
        where: { variantId, status: 'PENDING', id: { not: review.id } },
        data: { status: 'SUPERSEDED' },
      });
      return mapReview(applied);
    });
  }
}

const decimal = (value: DecimalValue | null) => value?.toString() ?? null;
const mapRules = (rules: PersistenceRules): PricingRules => ({
  id: rules.id, version: rules.version, status: rules.status as PricingRules['status'], currency: 'ARS',
  fulfillmentCost: decimal(rules.fulfillmentCost), packagingCost: decimal(rules.packagingCost),
  paymentFixedCost: decimal(rules.paymentFixedCost), paymentFeePercent: decimal(rules.paymentFeePercent),
  subsidizedShippingCost: decimal(rules.subsidizedShippingCost), taxPercent: decimal(rules.taxPercent),
  otherCost: decimal(rules.otherCost), targetMarginPercent: decimal(rules.targetMarginPercent),
});
const mapReview = (review: PersistenceReview): PricingReview => ({
  id: review.id, variantId: review.variantId, supplierOfferId: review.supplierOfferId,
  pricingRuleSetId: review.pricingRuleSetId, status: review.status as PricingReview['status'],
  inputSnapshot: review.inputSnapshot as Record<string, unknown>,
  recommendedPrice: review.recommendedPrice.toString(), commercialPrice: review.commercialPrice.toString(),
  breakdown: review.breakdown as PricingReview['breakdown'],
  createdAt: review.createdAt, appliedAt: review.appliedAt,
});
