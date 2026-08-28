export interface PricingRules {
  id: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
  currency: 'ARS';
  fulfillmentCost: string | null;
  packagingCost: string | null;
  paymentFixedCost: string | null;
  paymentFeePercent: string | null;
  paymentFeeVatApplies: boolean | null;
  paymentFeeVatPercent: string | null;
  paymentFeeScheduleId: string | null;
  subsidizedShippingCost: string | null;
  taxPercent: string | null;
  otherCost: string | null;
  targetMarginPercent: string | null;
  createdAt: Date;
  activatedAt: Date | null;
}

export type PricingRuleValues = Pick<
  PricingRules,
  | 'fulfillmentCost'
  | 'packagingCost'
  | 'paymentFixedCost'
  | 'paymentFeePercent'
  | 'paymentFeeVatApplies'
  | 'paymentFeeVatPercent'
  | 'paymentFeeScheduleId'
  | 'subsidizedShippingCost'
  | 'taxPercent'
  | 'otherCost'
  | 'targetMarginPercent'
>;

export interface PricingContext {
  variantId: string;
  variantRevision: number;
  currentSalePrice: string | null;
  supplierOfferId: string;
  supplierRevision: number;
  supplierUnitCost: string;
}

export interface PricingBreakdown {
  productCost: string;
  fulfillment: string;
  packaging: string;
  paymentFixed: string;
  paymentVariable: string;
  paymentFeeTax: string;
  fixedMonthlyAllocation: string;
  subsidizedShipping: string;
  taxes: string;
  other: string;
  effectiveCost: string;
  estimatedProfit: string;
  resultingMarginPercent: string;
}

export interface PricingCalculation {
  recommendedPrice: string;
  commercialPrice: string;
  breakdown: PricingBreakdown;
}

export interface PricingReviewSaveInput {
  context: PricingContext;
  rules: PricingRules;
  effectiveRules: PricingRuleValues;
  calculation: PricingCalculation;
}

export interface PricingReview extends PricingCalculation {
  id: string;
  variantId: string;
  supplierOfferId: string;
  pricingRuleSetId: string;
  status: 'PENDING' | 'APPLIED' | 'SUPERSEDED';
  inputSnapshot: Record<string, unknown>;
  createdAt: Date;
  appliedAt: Date | null;
  product?: { id: string; name: string };
  variant?: {
    sku: string | null;
    presentation: string | null;
    salePrice: string | null;
  };
  currentMarginPercent?: string | null;
}

export interface PricingReviewPage {
  items: PricingReview[];
  page: number;
  perPage: number;
  total: number;
}

export interface PaymentFeeSchedule {
  id: string;
  provider: 'MERCADOPAGO' | 'PAYWAY';
  product: 'CHECKOUT_PRO';
  name: string;
  settlementDays: number;
  feePercent: string;
  vatApplies: boolean;
  vatPercent: string;
  fixedFee: string;
  currency: 'ARS';
  active: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentFeeScheduleInput = Omit<
  PaymentFeeSchedule,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface OperatingCost {
  id: string;
  name: string;
  type: 'FIXED_MONTHLY' | 'PER_ORDER' | 'PER_UNIT' | 'PERCENT_OF_SALE';
  amount: string | null;
  percent: string | null;
  currency: 'ARS';
  active: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type OperatingCostInput = Omit<
  OperatingCost,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface PricingScenario {
  id: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  ordersSource: 'MANUAL' | 'PREVIOUS_PERIOD';
  projectedOrders: number;
  averageItemsPerOrder: string;
  paymentFeeScheduleId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PricingScenarioInput = Omit<
  PricingScenario,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface PricingScenarioInventorySnapshot {
  onHand: number;
  reserved: number;
  available: number;
}

export interface PricingScenarioVariantDetail {
  variantId: string;
  productId: string;
  productName: string;
  productStatus: string;
  sku: string | null;
  presentation: string | null;
  weightGrams: number | null;
  salePrice: string;
  supplierOfferId: string;
  supplierName: string;
  unitCost: string;
  inventory: PricingScenarioInventorySnapshot | null;
}

export interface PricingScenarioVariantInput {
  salePrice: string;
  unitCost: string;
  detail?: PricingScenarioVariantDetail;
}

export interface PricingScenarioCostLine {
  id: string;
  name: string;
  type: OperatingCost['type'];
  amount: string | null;
  percent: string | null;
}

export interface PricingScenarioCostBreakdown {
  fixedMonthly: PricingScenarioCostLine[];
  perOrder: PricingScenarioCostLine[];
  perUnit: PricingScenarioCostLine[];
  percentOfSale: PricingScenarioCostLine[];
  totals: {
    fixedMonthly: string;
    configuredPerOrder: string;
    configuredPerUnit: string;
    configuredPercentOfSale: string;
  };
  rules: {
    packaging: string;
    subsidizedShipping: string;
    paymentFixed: string;
    fulfillment: string;
    other: string;
    paymentFeePercent: string;
    paymentFeeVatApplies: boolean;
    paymentFeeVatPercent: string;
    paymentFeeEffectivePercent: string;
    taxPercent: string;
    totalPercentRate: string;
  };
  averages: {
    supplierCostPerUnit: string;
    operatingCostPerUnit: string;
    percentageCostPerUnit: string;
    variableCostPerUnit: string;
    contributionPerUnit: string;
    costsPerOrder: string;
    contributionPerOrder: string;
  };
}

export interface PricingScenarioAnalysis {
  scenario: PricingScenario;
  ordersUsed: number;
  previousPeriodOrders: number | null;
  sourceResolved: 'MANUAL' | 'PREVIOUS_PERIOD' | 'MANUAL_FALLBACK';
  averageSalePricePerUnit: string;
  averageVariableCostPerUnit: string;
  averageContributionPerOrder: string;
  fixedMonthlyCosts: string;
  projectedRevenue: string;
  projectedContribution: string;
  projectedOperatingResult: string;
  breakEvenOrders: number | null;
  breakEvenRevenue: string | null;
  paymentFeeSchedule: PaymentFeeScheduleSummary | null;
  catalogCoverage: {
    variantsConsidered: number;
    variantsIncluded: number;
    variantsWithoutActiveOffer: number;
    supplierOfferSelection: 'LOWEST_ACTIVE_UNIT_COST';
    inventoryUsed: false;
    productStatusFilterApplied: false;
    includedVariants: PricingScenarioVariantDetail[];
  };
  costBreakdown: PricingScenarioCostBreakdown;
}

export interface PricingScenarioAllocation {
  scenarioId: string;
  fixedCostPerUnit: string;
  projectedOrders: number;
  averageItemsPerOrder: string;
  paymentFeeOverrides: Pick<
    PricingRuleValues,
    | 'paymentFixedCost'
    | 'paymentFeePercent'
    | 'paymentFeeVatApplies'
    | 'paymentFeeVatPercent'
    | 'paymentFeeScheduleId'
  > | null;
}

export interface PaymentFeeScheduleSummary {
  id: string;
  provider: PaymentFeeSchedule['provider'];
  product: PaymentFeeSchedule['product'];
  name: string;
  settlementDays: number;
  feePercent: string;
  vatApplies: boolean;
  vatPercent: string;
  fixedFee: string;
}
