import type {
  PricingCalculation,
  PricingContext,
  PricingReview,
  PricingReviewSaveInput,
  PricingReviewPage,
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
} from '../pricing.types';

export const PRICING_REPOSITORY = Symbol('PRICING_REPOSITORY');

export interface PricingRepository {
  getRules(): Promise<{
    active: PricingRules | null;
    draft: PricingRules | null;
  }>;
  updateDraft(input: Partial<PricingRuleValues>): Promise<PricingRules>;
  activateDraft(): Promise<PricingRules>;
  getContext(
    variantId: string,
    supplierOfferId?: string,
  ): Promise<PricingContext | null>;
  listContextsForBulkRecalculation(): Promise<PricingContext[]>;
  setPreferredSupplierOffer(
    variantId: string,
    supplierOfferId: string,
  ): Promise<void>;
  saveReview(
    context: PricingContext,
    rules: PricingRules,
    effectiveRules: PricingRuleValues,
    calculation: PricingCalculation,
  ): Promise<PricingReview>;
  saveReviews(inputs: PricingReviewSaveInput[]): Promise<PricingReview[]>;
  listReviews(variantId: string): Promise<PricingReview[]>;
  listAllReviews(filter: {
    status?: PricingReview['status'];
    q?: string;
    page: number;
    perPage: number;
  }): Promise<PricingReviewPage>;
  listRuleHistory(): Promise<PricingRules[]>;
  applyReview(
    variantId: string,
    reviewId: string,
    options?: { activateProduct?: boolean },
  ): Promise<PricingReview>;
  listPaymentFeeSchedules(active?: boolean): Promise<PaymentFeeSchedule[]>;
  getPaymentFeeSchedule(id: string): Promise<PaymentFeeSchedule | null>;
  createPaymentFeeSchedule(
    input: PaymentFeeScheduleInput,
  ): Promise<PaymentFeeSchedule>;
  updatePaymentFeeSchedule(
    id: string,
    input: Partial<PaymentFeeScheduleInput>,
  ): Promise<PaymentFeeSchedule>;
  listOperatingCosts(active?: boolean): Promise<OperatingCost[]>;
  createOperatingCost(input: OperatingCostInput): Promise<OperatingCost>;
  updateOperatingCost(
    id: string,
    input: Partial<OperatingCostInput>,
  ): Promise<OperatingCost>;
  listPricingScenarios(): Promise<PricingScenario[]>;
  createPricingScenario(input: PricingScenarioInput): Promise<PricingScenario>;
  updatePricingScenario(
    id: string,
    input: Partial<PricingScenarioInput>,
  ): Promise<PricingScenario>;
  analyzePricingScenario(id: string): Promise<PricingScenarioAnalysis>;
  getPricingScenarioAllocation(id: string): Promise<PricingScenarioAllocation>;
}
