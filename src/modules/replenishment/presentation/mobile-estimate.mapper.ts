import type { ReplenishmentEstimate } from '../domain/estimate.types';

export const toMobileEstimate = (estimate: ReplenishmentEstimate) => ({
  id: estimate.id,
  dailyGrams: {
    ...estimate.dailyGrams,
    nominal: Math.round(
      (estimate.dailyGrams.min + estimate.dailyGrams.max) / 2,
    ),
  },
  durationDays: {
    ...estimate.durationDays,
    nominal: Math.round(
      (estimate.durationDays.min + estimate.durationDays.max) / 2,
    ),
  },
  source: estimate.source,
  sourceLabel: estimate.sourceLabel,
  sourceUrl: estimate.sourceUrl,
  estimatedDepletionAt: estimate.estimatedDepletionDate.toISOString(),
  assumptions: estimate.assumptions,
  food: {
    productId: estimate.productId,
    variantId: estimate.variantId,
    custom: estimate.custom,
  },
});
