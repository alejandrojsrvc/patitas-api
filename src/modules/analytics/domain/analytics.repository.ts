import type { ProductViewStats } from './analytics.types';

export const ANALYTICS_REPOSITORY = Symbol('ANALYTICS_REPOSITORY');

export interface AnalyticsRepository {
  recordProductView(slug: string, viewerKey: string, customerId?: string): Promise<void>;
  listRecentlyViewed(viewerKey: string, limit: number): Promise<unknown[]>;
  getProductStats(productId: string, from: Date, to: Date): Promise<ProductViewStats>;
}
