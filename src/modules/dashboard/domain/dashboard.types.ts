import type { PricingRules } from '../../pricing/domain/pricing.types';

export interface DashboardAlert {
  type: 'LOW_MARGIN';
  productId: string;
  variantId: string;
  label: string;
  currentMargin: number;
  targetMargin: number;
}

export interface DashboardSummary {
  activeProducts: number;
  variantsWithoutPrice: number;
  pendingPricingReviews: number;
  variantsWithoutSupplier: number;
  averageMarginPercent: number | null;
  alerts: DashboardAlert[];
}

export interface DashboardRepository {
  summary(rules: PricingRules | null): Promise<DashboardSummary>;
}

export const DASHBOARD_REPOSITORY = Symbol('DASHBOARD_REPOSITORY');
