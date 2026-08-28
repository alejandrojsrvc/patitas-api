import { PricingPreconditionError } from './errors/pricing.error';
import type {
  OperatingCost,
  PricingRules,
  PricingScenario,
  PricingScenarioAnalysis,
  PricingScenarioCostBreakdown,
  PricingScenarioCostLine,
  PaymentFeeScheduleSummary,
  PricingScenarioVariantInput,
} from './pricing.types';

export class PricingScenarioCalculator {
  public calculate(input: {
    scenario: PricingScenario;
    rules: PricingRules;
    operatingCosts: OperatingCost[];
    variants: PricingScenarioVariantInput[];
    variantsConsidered?: number;
    previousPeriodOrders: number | null;
    paymentFeeSchedule?: PaymentFeeScheduleSummary | null;
  }): PricingScenarioAnalysis {
    const { scenario, rules, operatingCosts } = input;
    if (!input.variants.length) {
      throw new PricingPreconditionError(
        'No hay variantes con precio y costo para analizar el escenario.',
      );
    }
    const orders = resolveOrders(scenario, input.previousPeriodOrders);
    const itemsPerOrder = positiveNumber(scenario.averageItemsPerOrder);
    const averageSalePrice = average(
      input.variants.map((item) => item.salePrice),
    );
    const averageProductCost = average(
      input.variants.map((item) => item.unitCost),
    );
    const fixedMonthly = sumCosts(operatingCosts, 'FIXED_MONTHLY');
    const perOrder =
      sumCosts(operatingCosts, 'PER_ORDER') +
      money(rules.packagingCost) +
      money(rules.subsidizedShippingCost) +
      money(rules.paymentFixedCost);
    const perUnit =
      sumCosts(operatingCosts, 'PER_UNIT') +
      money(rules.fulfillmentCost) +
      money(rules.otherCost);
    const paymentFeeVatApplies = rules.paymentFeeVatApplies !== false;
    const percentRate =
      percent(rules.paymentFeePercent) *
        (paymentFeeVatApplies
          ? 1 + percent(rules.paymentFeeVatPercent) / 100
          : 1) +
      percent(rules.taxPercent) +
      sumPercentCosts(operatingCosts);
    const averageVariableCost =
      averageProductCost + perUnit + (averageSalePrice * percentRate) / 100;
    const contributionPerUnit = averageSalePrice - averageVariableCost;
    const contributionPerOrder = contributionPerUnit * itemsPerOrder - perOrder;
    const projectedRevenue = averageSalePrice * itemsPerOrder * orders;
    const projectedContribution = contributionPerOrder * orders;
    const projectedOperatingResult = projectedContribution - fixedMonthly;
    const breakEvenOrders =
      contributionPerOrder > 0
        ? Math.ceil(fixedMonthly / contributionPerOrder)
        : null;

    return {
      scenario,
      paymentFeeSchedule: input.paymentFeeSchedule ?? null,
      ordersUsed: orders,
      previousPeriodOrders: input.previousPeriodOrders,
      sourceResolved:
        scenario.ordersSource === 'PREVIOUS_PERIOD' &&
        input.previousPeriodOrders !== null
          ? 'PREVIOUS_PERIOD'
          : scenario.ordersSource === 'PREVIOUS_PERIOD'
            ? 'MANUAL_FALLBACK'
            : 'MANUAL',
      averageSalePricePerUnit: format(averageSalePrice),
      averageVariableCostPerUnit: format(averageVariableCost),
      averageContributionPerOrder: format(contributionPerOrder),
      fixedMonthlyCosts: format(fixedMonthly),
      projectedRevenue: format(projectedRevenue),
      projectedContribution: format(projectedContribution),
      projectedOperatingResult: format(projectedOperatingResult),
      breakEvenOrders,
      breakEvenRevenue:
        breakEvenOrders === null
          ? null
          : format(averageSalePrice * itemsPerOrder * breakEvenOrders),
      catalogCoverage: {
        variantsConsidered: input.variantsConsidered ?? input.variants.length,
        variantsIncluded: input.variants.length,
        variantsWithoutActiveOffer: Math.max(
          0,
          (input.variantsConsidered ?? input.variants.length) -
            input.variants.length,
        ),
        supplierOfferSelection: 'LOWEST_ACTIVE_UNIT_COST',
        inventoryUsed: false,
        productStatusFilterApplied: false,
        includedVariants: input.variants.flatMap((variant) =>
          variant.detail ? [variant.detail] : [],
        ),
      },
      costBreakdown: buildCostBreakdown({
        operatingCosts,
        rules,
        averageProductCost,
        averageSalePrice,
        averageVariableCost,
        contributionPerUnit,
        perOrder,
        contributionPerOrder,
        percentRate,
        paymentFeeVatApplies,
      }),
    };
  }
}

const resolveOrders = (
  scenario: PricingScenario,
  previousPeriodOrders: number | null,
): number =>
  scenario.ordersSource === 'PREVIOUS_PERIOD' && previousPeriodOrders !== null
    ? previousPeriodOrders
    : scenario.projectedOrders;

const positiveNumber = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PricingPreconditionError(
      'La media de productos por pedido debe ser mayor que cero.',
    );
  }
  return parsed;
};

const money = (value: string | null): number => Number(value ?? 0);
const percent = (value: string | null): number => Number(value ?? 0);
const format = (value: number): string => value.toFixed(2);

const average = (values: string[]): number =>
  values.reduce((sum, value) => sum + Number(value), 0) / values.length;

const sumCosts = (
  costs: OperatingCost[],
  type: OperatingCost['type'],
): number =>
  costs
    .filter((cost) => cost.type === type)
    .reduce((sum, cost) => sum + money(cost.amount), 0);

const sumPercentCosts = (costs: OperatingCost[]): number =>
  costs
    .filter((cost) => cost.type === 'PERCENT_OF_SALE')
    .reduce((sum, cost) => sum + percent(cost.percent), 0);

const costLines = (
  costs: OperatingCost[],
  type: OperatingCost['type'],
): PricingScenarioCostLine[] =>
  costs
    .filter((cost) => cost.type === type)
    .map((cost) => ({
      id: cost.id,
      name: cost.name,
      type: cost.type,
      amount: cost.amount,
      percent: cost.percent,
    }));

const buildCostBreakdown = (input: {
  operatingCosts: OperatingCost[];
  rules: PricingRules;
  averageProductCost: number;
  averageSalePrice: number;
  averageVariableCost: number;
  contributionPerUnit: number;
  perOrder: number;
  contributionPerOrder: number;
  percentRate: number;
  paymentFeeVatApplies: boolean;
}): PricingScenarioCostBreakdown => {
  const {
    operatingCosts,
    rules,
    averageProductCost,
    averageSalePrice,
    averageVariableCost,
    contributionPerUnit,
    perOrder,
    contributionPerOrder,
    percentRate,
    paymentFeeVatApplies,
  } = input;
  const paymentFeePercent = percent(rules.paymentFeePercent);
  const paymentFeeVatPercent = percent(rules.paymentFeeVatPercent);
  const paymentFeeEffectivePercent =
    paymentFeePercent * (1 + paymentFeeVatPercent / 100);
  const configuredPerUnit = sumCosts(operatingCosts, 'PER_UNIT');
  const percentageCostPerUnit = (averageSalePrice * percentRate) / 100;

  return {
    fixedMonthly: costLines(operatingCosts, 'FIXED_MONTHLY'),
    perOrder: costLines(operatingCosts, 'PER_ORDER'),
    perUnit: costLines(operatingCosts, 'PER_UNIT'),
    percentOfSale: costLines(operatingCosts, 'PERCENT_OF_SALE'),
    totals: {
      fixedMonthly: format(sumCosts(operatingCosts, 'FIXED_MONTHLY')),
      configuredPerOrder: format(sumCosts(operatingCosts, 'PER_ORDER')),
      configuredPerUnit: format(configuredPerUnit),
      configuredPercentOfSale: format(sumPercentCosts(operatingCosts)),
    },
    rules: {
      packaging: format(money(rules.packagingCost)),
      subsidizedShipping: format(money(rules.subsidizedShippingCost)),
      paymentFixed: format(money(rules.paymentFixedCost)),
      fulfillment: format(money(rules.fulfillmentCost)),
      other: format(money(rules.otherCost)),
      paymentFeePercent: formatPercent(paymentFeePercent),
      paymentFeeVatApplies,
      paymentFeeVatPercent: formatPercent(paymentFeeVatPercent),
      paymentFeeEffectivePercent: formatPercent(
        paymentFeeVatApplies ? paymentFeeEffectivePercent : paymentFeePercent,
      ),
      taxPercent: formatPercent(percent(rules.taxPercent)),
      totalPercentRate: formatPercent(percentRate),
    },
    averages: {
      supplierCostPerUnit: format(averageProductCost),
      operatingCostPerUnit: format(
        configuredPerUnit +
          money(rules.fulfillmentCost) +
          money(rules.otherCost),
      ),
      percentageCostPerUnit: format(percentageCostPerUnit),
      variableCostPerUnit: format(averageVariableCost),
      contributionPerUnit: format(contributionPerUnit),
      costsPerOrder: format(perOrder),
      contributionPerOrder: format(contributionPerOrder),
    },
  };
};

const formatPercent = (value: number): string => value.toFixed(4);
