import type {
  PricingCalculation,
  PricingContext,
  PricingReview,
  PricingReviewPage,
  PricingRules,
  PricingRuleValues,
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
  saveReview(
    context: PricingContext,
    rules: PricingRules,
    effectiveRules: PricingRuleValues,
    calculation: PricingCalculation,
  ): Promise<PricingReview>;
  listReviews(variantId: string): Promise<PricingReview[]>;
  listAllReviews(filter: {
    status?: PricingReview['status'];
    q?: string;
    page: number;
    perPage: number;
  }): Promise<PricingReviewPage>;
  listRuleHistory(): Promise<PricingRules[]>;
  applyReview(variantId: string, reviewId: string): Promise<PricingReview>;
}
