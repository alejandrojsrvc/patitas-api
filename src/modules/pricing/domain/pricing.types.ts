export interface PricingRules {
  id: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
  currency: 'ARS';
  fulfillmentCost: string | null;
  packagingCost: string | null;
  paymentFixedCost: string | null;
  paymentFeePercent: string | null;
  subsidizedShippingCost: string | null;
  taxPercent: string | null;
  otherCost: string | null;
  targetMarginPercent: string | null;
}

export type PricingRuleValues = Omit<PricingRules, 'id' | 'version' | 'status' | 'currency'>;

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

export interface PricingReview extends PricingCalculation {
  id: string;
  variantId: string;
  supplierOfferId: string;
  pricingRuleSetId: string;
  status: 'PENDING' | 'APPLIED' | 'SUPERSEDED';
  inputSnapshot: Record<string, unknown>;
  createdAt: Date;
  appliedAt: Date | null;
}
