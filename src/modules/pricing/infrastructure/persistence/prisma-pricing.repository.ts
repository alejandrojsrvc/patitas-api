import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type { Prisma } from '../../../../infrastructure/database/generated/prisma/client';
import {
  PricingNotFoundError,
  PricingPreconditionError,
  StalePricingReviewError,
} from '../../domain/errors/pricing.error';
import { PricingScenarioCalculator } from '../../domain/pricing-scenario-calculator';
import type { PricingRepository } from '../../domain/repositories/pricing.repository';
import type {
  PricingCalculation,
  PricingContext,
  PricingReview,
  PricingReviewPage,
  PricingReviewSaveInput,
  PricingRules,
  PricingRuleValues,
  OperatingCost,
  OperatingCostInput,
  PaymentFeeSchedule,
  PaymentFeeScheduleInput,
  PricingScenario,
  PricingScenarioAnalysis,
  PricingScenarioAllocation,
  PricingScenarioInput,
  PricingScenarioVariantDetail,
  PaymentFeeScheduleSummary,
} from '../../domain/pricing.types';

interface DecimalValue {
  toString(): string;
}
interface PersistenceRules {
  id: string;
  version: number;
  status: string;
  currency: string;
  fulfillmentCost: DecimalValue | null;
  packagingCost: DecimalValue | null;
  paymentFixedCost: DecimalValue | null;
  paymentFeePercent: DecimalValue | null;
  paymentFeeVatApplies: boolean | null;
  paymentFeeVatPercent: DecimalValue | null;
  paymentFeeScheduleId: string | null;
  subsidizedShippingCost: DecimalValue | null;
  taxPercent: DecimalValue | null;
  otherCost: DecimalValue | null;
  targetMarginPercent: DecimalValue | null;
  createdAt: Date;
  activatedAt: Date | null;
}
interface PersistenceReview {
  id: string;
  variantId: string;
  supplierOfferId: string;
  pricingRuleSetId: string;
  status: string;
  inputSnapshot: unknown;
  breakdown: unknown;
  recommendedPrice: DecimalValue;
  commercialPrice: DecimalValue;
  createdAt: Date;
  appliedAt: Date | null;
}
interface SupplierOfferCost {
  active: boolean;
  unitCost: DecimalValue;
}
type PricingReviewWithRelations = Prisma.PricingReviewGetPayload<{
  include: {
    variant: { include: { product: true } };
    supplierOffer: true;
    pricingRuleSet: true;
  };
}>;

@Injectable()
export class PrismaPricingRepository implements PricingRepository {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly scenarioCalculator: PricingScenarioCalculator,
  ) {}

  public async getRules() {
    const [active, draft] = await Promise.all([
      this.prisma.pricingRuleSet.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { version: 'desc' },
      }),
      this.prisma.pricingRuleSet.findFirst({
        where: { status: 'DRAFT' },
        orderBy: { version: 'desc' },
      }),
    ]);
    return {
      active: active ? mapRules(active) : null,
      draft: draft ? mapRules(draft) : null,
    };
  }

  public async listRuleHistory(): Promise<PricingRules[]> {
    const rules = await this.prisma.pricingRuleSet.findMany({
      orderBy: { version: 'desc' },
    });
    return rules.map(mapRules);
  }

  public async updateDraft(
    input: Partial<PricingRuleValues>,
  ): Promise<PricingRules> {
    return this.prisma.$transaction(async (transaction) => {
      const draft = await transaction.pricingRuleSet.findFirst({
        where: { status: 'DRAFT' },
        orderBy: { version: 'desc' },
      });
      if (draft) {
        return mapRules(
          await transaction.pricingRuleSet.update({
            where: { id: draft.id },
            data: input,
          }),
        );
      }
      const latest = await transaction.pricingRuleSet.findFirst({
        orderBy: { version: 'desc' },
      });
      const inherited = latest
        ? {
            currency: latest.currency,
            fulfillmentCost: latest.fulfillmentCost,
            packagingCost: latest.packagingCost,
            paymentFixedCost: latest.paymentFixedCost,
            paymentFeePercent: latest.paymentFeePercent,
            paymentFeeVatApplies: latest.paymentFeeVatApplies,
            paymentFeeVatPercent: latest.paymentFeeVatPercent,
            paymentFeeScheduleId: latest.paymentFeeScheduleId,
            subsidizedShippingCost: latest.subsidizedShippingCost,
            taxPercent: latest.taxPercent,
            otherCost: latest.otherCost,
            targetMarginPercent: latest.targetMarginPercent,
          }
        : { currency: 'ARS' };
      return mapRules(
        await transaction.pricingRuleSet.create({
          data: {
            ...inherited,
            ...input,
            version: (latest?.version ?? 0) + 1,
            status: 'DRAFT',
          },
        }),
      );
    });
  }

  public async activateDraft(): Promise<PricingRules> {
    return this.prisma.$transaction(async (transaction) => {
      const draft = await transaction.pricingRuleSet.findFirst({
        where: { status: 'DRAFT' },
        orderBy: { version: 'desc' },
      });
      if (!draft)
        throw new PricingPreconditionError(
          'No existe una configuración borrador.',
        );
      await transaction.pricingRuleSet.updateMany({
        where: { status: 'ACTIVE' },
        data: { status: 'SUPERSEDED' },
      });
      return mapRules(
        await transaction.pricingRuleSet.update({
          where: { id: draft.id },
          data: { status: 'ACTIVE', activatedAt: new Date() },
        }),
      );
    });
  }

  public async getContext(
    variantId: string,
    supplierOfferId?: string,
  ): Promise<PricingContext | null> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        revision: true,
        salePrice: true,
        preferredSupplierOfferId: true,
      },
    });
    if (!variant) return null;
    const offerId = supplierOfferId ?? variant.preferredSupplierOfferId;
    if (!offerId) return null;
    const offer = await this.prisma.supplierOffer.findUnique({
      where: { id: offerId },
    });
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

  public async listContextsForBulkRecalculation(): Promise<PricingContext[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        active: true,
        supplierOffers: { some: { active: true } },
      },
      select: {
        id: true,
        revision: true,
        salePrice: true,
        supplierOffers: {
          where: { active: true },
          orderBy: { unitCost: 'asc' },
          take: 1,
          select: {
            id: true,
            revision: true,
            unitCost: true,
          },
        },
      },
    });

    return variants.flatMap((variant) => {
      const offer = variant.supplierOffers[0];
      return offer
        ? [
            {
              variantId: variant.id,
              variantRevision: variant.revision,
              currentSalePrice: variant.salePrice?.toString() ?? null,
              supplierOfferId: offer.id,
              supplierRevision: offer.revision,
              supplierUnitCost: offer.unitCost.toString(),
            },
          ]
        : [];
    });
  }

  public async setPreferredSupplierOffer(
    variantId: string,
    supplierOfferId: string,
  ): Promise<void> {
    const offer = await this.prisma.supplierOffer.findUnique({
      where: { id: supplierOfferId },
      select: { variantId: true, active: true },
    });
    if (!offer || offer.variantId !== variantId || !offer.active) {
      throw new PricingPreconditionError(
        'La oferta preferida no pertenece a la variante o está inactiva.',
      );
    }
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        preferredSupplierOfferId: supplierOfferId,
        revision: { increment: 1 },
      },
    });
  }

  public async saveReview(
    context: PricingContext,
    rules: PricingRules,
    effectiveRules: PricingRuleValues,
    calculation: PricingCalculation,
  ): Promise<PricingReview> {
    const [review] = await this.saveReviews([
      { context, rules, effectiveRules, calculation },
    ]);
    return review;
  }

  public async saveReviews(
    inputs: PricingReviewSaveInput[],
  ): Promise<PricingReview[]> {
    return this.prisma.$transaction(async (transaction) => {
      const reviews: PricingReview[] = [];
      for (const input of inputs) {
        await transaction.pricingReview.updateMany({
          where: { variantId: input.context.variantId, status: 'PENDING' },
          data: { status: 'SUPERSEDED' },
        });
        const review = await transaction.pricingReview.create({
          data: {
            variantId: input.context.variantId,
            supplierOfferId: input.context.supplierOfferId,
            pricingRuleSetId: input.rules.id,
            variantRevision: input.context.variantRevision,
            supplierRevision: input.context.supplierRevision,
            inputSnapshot: {
              currentSalePrice: input.context.currentSalePrice,
              supplierUnitCost: input.context.supplierUnitCost,
              pricingRuleVersion: input.rules.version,
              effectiveRules: input.effectiveRules,
            },
            breakdown: input.calculation
              .breakdown as unknown as Prisma.InputJsonObject,
            recommendedPrice: input.calculation.recommendedPrice,
            commercialPrice: input.calculation.commercialPrice,
          },
        });
        reviews.push(mapReview(review));
      }
      return reviews;
    });
  }

  public async listReviews(variantId: string): Promise<PricingReview[]> {
    const reviews = await this.prisma.pricingReview.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
    });
    return reviews.map(mapReview);
  }

  public async listAllReviews(filter: {
    status?: PricingReview['status'];
    q?: string;
    page: number;
    perPage: number;
  }): Promise<PricingReviewPage> {
    const q = filter.q?.trim();
    const where: Prisma.PricingReviewWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(q
        ? {
            OR: [
              { variant: { sku: { contains: q, mode: 'insensitive' } } },
              {
                variant: { presentation: { contains: q, mode: 'insensitive' } },
              },
              {
                variant: {
                  product: { name: { contains: q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.pricingReview.findMany({
        where,
        include: {
          variant: { include: { product: true } },
          supplierOffer: true,
          pricingRuleSet: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.prisma.pricingReview.count({ where }),
    ]);
    return {
      items: reviews.map((review: PricingReviewWithRelations) => ({
        ...mapReview(review),
        product: {
          id: review.variant.product.id,
          name: review.variant.product.name,
        },
        variant: {
          sku: review.variant.sku,
          presentation: review.variant.presentation,
          salePrice: decimal(review.variant.salePrice),
        },
        currentMarginPercent: calculateMargin(
          review.variant.salePrice,
          review.supplierOffer,
          review.pricingRuleSet,
        ),
      })),
      page: filter.page,
      perPage: filter.perPage,
      total,
    };
  }

  public async applyReview(
    variantId: string,
    reviewId: string,
    options: { activateProduct?: boolean } = {},
  ): Promise<PricingReview> {
    return this.prisma.$transaction(async (transaction) => {
      const review = await transaction.pricingReview.findUnique({
        where: { id: reviewId },
        include: {
          variant: {
            include: {
              product: {
                include: {
                  brand: true,
                  category: true,
                  media: true,
                  variants: true,
                },
              },
            },
          },
          supplierOffer: true,
          pricingRuleSet: true,
        },
      });
      if (!review || review.variantId !== variantId) {
        throw new PricingNotFoundError('La revisión de precio no existe.');
      }
      const stale =
        review.status !== 'PENDING' ||
        review.variant.revision !== review.variantRevision ||
        review.supplierOffer.revision !== review.supplierRevision ||
        review.pricingRuleSet.status !== 'ACTIVE' ||
        (review.variant.preferredSupplierOfferId !== null &&
          review.variant.preferredSupplierOfferId !== review.supplierOfferId);
      if (stale) {
        throw new StalePricingReviewError(
          'La revisión quedó obsoleta; recalcula antes de aplicar el precio.',
        );
      }
      if (options.activateProduct) {
        const product = review.variant.product;
        const sellable = product.variants.some((variant) =>
          variant.id === variantId
            ? variant.active &&
              Boolean(variant.sku) &&
              Number(review.commercialPrice) > 0
            : variant.active &&
              Boolean(variant.sku) &&
              Number(variant.salePrice) > 0,
        );
        if (
          !product.categoryId ||
          !product.category?.active ||
          !product.brand.active ||
          !sellable ||
          !product.media.some((media) => media.url.trim())
        ) {
          throw new PricingPreconditionError(
            'No se puede activar el producto: requiere categoría, marca, imagen, SKU y precio de venta.',
          );
        }
      }
      await transaction.productVariant.update({
        where: { id: variantId },
        data: { salePrice: review.commercialPrice, revision: { increment: 1 } },
      });
      const applied = await transaction.pricingReview.update({
        where: { id: review.id },
        data: { status: 'APPLIED', appliedAt: new Date() },
      });
      await transaction.pricingReview.updateMany({
        where: { variantId, status: 'PENDING', id: { not: review.id } },
        data: { status: 'SUPERSEDED' },
      });
      if (options.activateProduct) {
        await transaction.product.update({
          where: { id: review.variant.product.id },
          data: { status: 'ACTIVE' },
        });
      }
      return mapReview(applied);
    });
  }

  public async listPaymentFeeSchedules(
    active?: boolean,
  ): Promise<PaymentFeeSchedule[]> {
    const schedules = await this.prisma.paymentFeeSchedule.findMany({
      where: active === undefined ? undefined : { active },
      orderBy: [{ settlementDays: 'asc' }, { effectiveFrom: 'desc' }],
    });
    return schedules.map(mapPaymentFeeSchedule);
  }

  public async getPaymentFeeSchedule(
    id: string,
  ): Promise<PaymentFeeSchedule | null> {
    const schedule = await this.prisma.paymentFeeSchedule.findUnique({
      where: { id },
    });
    return schedule ? mapPaymentFeeSchedule(schedule) : null;
  }

  public async createPaymentFeeSchedule(
    input: PaymentFeeScheduleInput,
  ): Promise<PaymentFeeSchedule> {
    const schedule = await this.prisma.paymentFeeSchedule.create({
      data: input,
    });
    return mapPaymentFeeSchedule(schedule);
  }

  public async updatePaymentFeeSchedule(
    id: string,
    input: Partial<PaymentFeeScheduleInput>,
  ): Promise<PaymentFeeSchedule> {
    try {
      const schedule = await this.prisma.paymentFeeSchedule.update({
        where: { id },
        data: input,
      });
      return mapPaymentFeeSchedule(schedule);
    } catch (error) {
      if (isPrismaNotFound(error)) {
        throw new PricingNotFoundError('La tarifa de pago no existe.');
      }
      throw error;
    }
  }

  public async listOperatingCosts(active?: boolean): Promise<OperatingCost[]> {
    const costs = await this.prisma.operatingCost.findMany({
      where: active === undefined ? undefined : { active },
      orderBy: [{ type: 'asc' }, { effectiveFrom: 'desc' }],
    });
    return costs.map(mapOperatingCost);
  }

  public async createOperatingCost(
    input: OperatingCostInput,
  ): Promise<OperatingCost> {
    const cost = await this.prisma.operatingCost.create({ data: input });
    return mapOperatingCost(cost);
  }

  public async updateOperatingCost(
    id: string,
    input: Partial<OperatingCostInput>,
  ): Promise<OperatingCost> {
    try {
      const cost = await this.prisma.operatingCost.update({
        where: { id },
        data: input,
      });
      return mapOperatingCost(cost);
    } catch (error) {
      if (isPrismaNotFound(error)) {
        throw new PricingNotFoundError('El costo operativo no existe.');
      }
      throw error;
    }
  }

  public async listPricingScenarios(): Promise<PricingScenario[]> {
    const scenarios = await this.prisma.pricingScenario.findMany({
      where: { active: true },
      orderBy: { periodStart: 'desc' },
    });
    return scenarios.map(mapPricingScenario);
  }

  public async createPricingScenario(
    input: PricingScenarioInput,
  ): Promise<PricingScenario> {
    const scenario = await this.prisma.pricingScenario.create({
      data: input,
    });
    return mapPricingScenario(scenario);
  }

  public async updatePricingScenario(
    id: string,
    input: Partial<PricingScenarioInput>,
  ): Promise<PricingScenario> {
    try {
      const scenario = await this.prisma.pricingScenario.update({
        where: { id },
        data: input,
      });
      return mapPricingScenario(scenario);
    } catch (error) {
      if (isPrismaNotFound(error)) {
        throw new PricingNotFoundError('El escenario de pricing no existe.');
      }
      throw error;
    }
  }

  public async analyzePricingScenario(
    id: string,
  ): Promise<PricingScenarioAnalysis> {
    const scenario = await this.prisma.pricingScenario.findUnique({
      where: { id },
      include: { paymentFeeSchedule: true },
    });
    if (!scenario) {
      throw new PricingNotFoundError('El escenario de pricing no existe.');
    }
    const [activeRules, operatingCosts, variants, previousPeriodOrders] =
      await Promise.all([
        this.prisma.pricingRuleSet.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { version: 'desc' },
        }),
        this.prisma.operatingCost.findMany({
          where: {
            active: true,
            effectiveFrom: { lt: scenario.periodEnd },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gt: scenario.periodStart } },
            ],
          },
          orderBy: { type: 'asc' },
        }),
        this.prisma.productVariant.findMany({
          where: { active: true, salePrice: { not: null } },
          select: {
            id: true,
            productId: true,
            sku: true,
            presentation: true,
            weightGrams: true,
            salePrice: true,
            product: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
            inventory: {
              select: {
                onHand: true,
                reserved: true,
              },
            },
            supplierOffers: {
              where: { active: true },
              select: {
                id: true,
                unitCost: true,
                supplier: {
                  select: { name: true },
                },
              },
              orderBy: { unitCost: 'asc' },
              take: 1,
            },
          },
        }),
        this.countPreviousPeriodOrders(
          scenario.periodStart,
          scenario.periodEnd,
        ),
      ]);
    if (!activeRules) {
      throw new PricingPreconditionError(
        'No existe una configuración activa de pricing.',
      );
    }
    const catalogVariants = variants.flatMap((variant) =>
      variant.salePrice && variant.supplierOffers[0]
        ? [
            {
              salePrice: variant.salePrice.toString(),
              unitCost: variant.supplierOffers[0].unitCost.toString(),
              detail: toPricingScenarioVariantDetail(variant),
            },
          ]
        : [],
    );
    const mappedScenario = mapPricingScenario(scenario);
    const mappedFeeSchedule = scenario.paymentFeeSchedule
      ? mapPaymentFeeScheduleSummary(scenario.paymentFeeSchedule)
      : null;
    const rules = mapRules(activeRules);
    const scenarioRules = scenario.paymentFeeSchedule
      ? {
          ...rules,
          paymentFixedCost: scenario.paymentFeeSchedule.fixedFee.toString(),
          paymentFeePercent: scenario.paymentFeeSchedule.feePercent.toString(),
          paymentFeeVatApplies: scenario.paymentFeeSchedule.vatApplies,
          paymentFeeVatPercent:
            scenario.paymentFeeSchedule.vatPercent.toString(),
          paymentFeeScheduleId: scenario.paymentFeeSchedule.id,
        }
      : rules;
    const analysis = this.scenarioCalculator.calculate({
      scenario: mappedScenario,
      rules: scenarioRules,
      operatingCosts: operatingCosts.map(mapOperatingCost),
      variants: catalogVariants,
      variantsConsidered: variants.length,
      previousPeriodOrders,
      paymentFeeSchedule: mappedFeeSchedule,
    });
    return analysis;
  }

  public async getPricingScenarioAllocation(
    id: string,
  ): Promise<PricingScenarioAllocation> {
    const analysis = await this.analyzePricingScenario(id);
    if (analysis.ordersUsed <= 0) {
      throw new PricingPreconditionError(
        'El escenario debe tener al menos un pedido para asignar costos fijos.',
      );
    }
    const items = Number(analysis.scenario.averageItemsPerOrder);
    return {
      scenarioId: id,
      fixedCostPerUnit: (
        Number(analysis.fixedMonthlyCosts) /
        (analysis.ordersUsed * items)
      ).toFixed(2),
      projectedOrders: analysis.ordersUsed,
      averageItemsPerOrder: analysis.scenario.averageItemsPerOrder,
      paymentFeeOverrides: analysis.paymentFeeSchedule
        ? {
            paymentFixedCost: analysis.paymentFeeSchedule.fixedFee,
            paymentFeePercent: analysis.paymentFeeSchedule.feePercent,
            paymentFeeVatApplies: analysis.paymentFeeSchedule.vatApplies,
            paymentFeeVatPercent: analysis.paymentFeeSchedule.vatPercent,
            paymentFeeScheduleId: analysis.paymentFeeSchedule.id,
          }
        : null,
    };
  }

  private async countPreviousPeriodOrders(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const duration = periodEnd.getTime() - periodStart.getTime();
    const previousStart = new Date(periodStart.getTime() - duration);
    return this.prisma.order.count({
      where: {
        status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        createdAt: { gte: previousStart, lt: periodStart },
      },
    });
  }
}

const decimal = (value: DecimalValue | null) => value?.toString() ?? null;
const mapRules = (rules: PersistenceRules): PricingRules => ({
  id: rules.id,
  version: rules.version,
  status: rules.status as PricingRules['status'],
  currency: 'ARS',
  fulfillmentCost: decimal(rules.fulfillmentCost),
  packagingCost: decimal(rules.packagingCost),
  paymentFixedCost: decimal(rules.paymentFixedCost),
  paymentFeePercent: decimal(rules.paymentFeePercent),
  paymentFeeVatApplies: rules.paymentFeeVatApplies,
  paymentFeeVatPercent: decimal(rules.paymentFeeVatPercent),
  paymentFeeScheduleId: rules.paymentFeeScheduleId,
  subsidizedShippingCost: decimal(rules.subsidizedShippingCost),
  taxPercent: decimal(rules.taxPercent),
  otherCost: decimal(rules.otherCost),
  targetMarginPercent: decimal(rules.targetMarginPercent),
  createdAt: rules.createdAt,
  activatedAt: rules.activatedAt,
});

const mapPaymentFeeSchedule = (schedule: {
  id: string;
  provider: string;
  product: string;
  name: string;
  settlementDays: number;
  feePercent: DecimalValue;
  vatApplies: boolean;
  vatPercent: DecimalValue;
  fixedFee: DecimalValue;
  currency: string;
  active: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentFeeSchedule => ({
  ...schedule,
  provider: schedule.provider as PaymentFeeSchedule['provider'],
  product: schedule.product as PaymentFeeSchedule['product'],
  currency: 'ARS',
  feePercent: schedule.feePercent.toString(),
  vatApplies: schedule.vatApplies,
  vatPercent: schedule.vatPercent.toString(),
  fixedFee: schedule.fixedFee.toString(),
});

const mapOperatingCost = (cost: {
  id: string;
  name: string;
  type: string;
  amount: DecimalValue | null;
  percent: DecimalValue | null;
  currency: string;
  active: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OperatingCost => ({
  ...cost,
  type: cost.type as OperatingCost['type'],
  currency: 'ARS',
  amount: decimal(cost.amount),
  percent: decimal(cost.percent),
});

const mapPricingScenario = (scenario: {
  id: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  ordersSource: string;
  projectedOrders: number;
  averageItemsPerOrder: DecimalValue;
  paymentFeeScheduleId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PricingScenario => ({
  ...scenario,
  ordersSource: scenario.ordersSource as PricingScenario['ordersSource'],
  averageItemsPerOrder: scenario.averageItemsPerOrder.toString(),
  paymentFeeScheduleId: scenario.paymentFeeScheduleId,
});

const mapPaymentFeeScheduleSummary = (schedule: {
  id: string;
  provider: string;
  product: string;
  name: string;
  settlementDays: number;
  feePercent: DecimalValue;
  vatApplies: boolean;
  vatPercent: DecimalValue;
  fixedFee: DecimalValue;
}): PaymentFeeScheduleSummary => ({
  id: schedule.id,
  provider: schedule.provider as PaymentFeeScheduleSummary['provider'],
  product: schedule.product as PaymentFeeScheduleSummary['product'],
  name: schedule.name,
  settlementDays: schedule.settlementDays,
  feePercent: schedule.feePercent.toString(),
  vatApplies: schedule.vatApplies,
  vatPercent: schedule.vatPercent.toString(),
  fixedFee: schedule.fixedFee.toString(),
});

const toPricingScenarioVariantDetail = (variant: {
  id: string;
  productId: string;
  sku: string | null;
  presentation: string | null;
  weightGrams: number | null;
  salePrice: DecimalValue | null;
  product: {
    id: string;
    name: string;
    status: string;
  };
  inventory: { onHand: number; reserved: number } | null;
  supplierOffers: Array<{
    id: string;
    unitCost: DecimalValue;
    supplier: { name: string };
  }>;
}): PricingScenarioVariantDetail => {
  const offer = variant.supplierOffers[0];
  const onHand = variant.inventory?.onHand ?? 0;
  const reserved = variant.inventory?.reserved ?? 0;

  return {
    variantId: variant.id,
    productId: variant.productId,
    productName: variant.product.name,
    productStatus: variant.product.status,
    sku: variant.sku,
    presentation: variant.presentation,
    weightGrams: variant.weightGrams,
    salePrice: variant.salePrice?.toString() ?? '0.00',
    supplierOfferId: offer.id,
    supplierName: offer.supplier.name,
    unitCost: offer.unitCost.toString(),
    inventory: variant.inventory
      ? {
          onHand,
          reserved,
          available: Math.max(0, onHand - reserved),
        }
      : null,
  };
};

const mapReview = (review: PersistenceReview): PricingReview => ({
  id: review.id,
  variantId: review.variantId,
  supplierOfferId: review.supplierOfferId,
  pricingRuleSetId: review.pricingRuleSetId,
  status: review.status as PricingReview['status'],
  inputSnapshot: review.inputSnapshot as Record<string, unknown>,
  recommendedPrice: review.recommendedPrice.toString(),
  commercialPrice: review.commercialPrice.toString(),
  breakdown: review.breakdown as PricingReview['breakdown'],
  createdAt: review.createdAt,
  appliedAt: review.appliedAt,
});

const calculateMargin = (
  salePrice: DecimalValue | null,
  offer: SupplierOfferCost | null,
  rules: PersistenceRules | null,
): string | null => {
  const price = Number(salePrice);
  if (
    !salePrice ||
    price <= 0 ||
    !offer?.active ||
    !rules ||
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
  const cost =
    fixed +
    (price * Number(rules.paymentFeePercent)) / 100 +
    (rules.paymentFeeVatApplies === false
      ? 0
      : ((price * Number(rules.paymentFeePercent)) / 100) *
        (Number(rules.paymentFeeVatPercent ?? 0) / 100)) +
    (price * Number(rules.taxPercent)) / 100;
  return (((price - cost) / price) * 100).toFixed(2);
};

const isPrismaNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'P2025';
