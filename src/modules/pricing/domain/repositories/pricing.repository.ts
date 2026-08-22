import type {
  PricingCalculation, PricingContext, PricingReview, PricingRules, PricingRuleValues,
} from '../pricing.types';

export const PRICING_REPOSITORY = Symbol('PRICING_REPOSITORY');

export interface PricingRepository {
  getRules(): Promise<{ active: PricingRules | null; draft: PricingRules | null }>;
  updateDraft(input: Partial<PricingRuleValues>): Promise<PricingRules>;
  activateDraft(): Promise<PricingRules>;
  getContext(variantId: string, supplierOfferId?: string): Promise<PricingContext | null>;
  saveReview(
    context: PricingContext,
    rules: PricingRules,
    effectiveRules: PricingRuleValues,
    calculation: PricingCalculation,
  ): Promise<PricingReview>;
  listReviews(variantId: string): Promise<PricingReview[]>;
  listAllReviews(status?: PricingReview['status']): Promise<PricingReview[]>;
  listRuleHistory(): Promise<PricingRules[]>;
  applyReview(variantId: string, reviewId: string): Promise<PricingReview>;
}
