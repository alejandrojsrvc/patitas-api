import type { ReplenishmentPlan } from '../domain/replenishment.types';

export const toMobilePlan = (plan: ReplenishmentPlan) => ({
  id: plan.id,
  petId: plan.petId,
  kind: 'food',
  product: {
    id: plan.productId,
    name: plan.productName ?? 'Alimento',
  },
  variant: {
    id: plan.variantId,
    presentation: plan.presentation,
    weightGrams: plan.weightGrams,
  },
  consumption: {
    status: consumptionStatus(plan),
    estimatedDaysRemaining: estimatedDaysRemaining(plan),
    estimatedDepletionAt: plan.estimatedDepletionDate.toISOString(),
    dailyGrams: {
      min: plan.dailyGramsMin ?? Number(plan.dailyConsumption),
      max: plan.dailyGramsMax ?? Number(plan.dailyConsumption),
      nominal: Math.round(
        ((plan.dailyGramsMin ?? Number(plan.dailyConsumption)) +
          (plan.dailyGramsMax ?? Number(plan.dailyConsumption))) /
          2,
      ),
    },
    startedAt: plan.bagStartedAt?.toISOString() ?? null,
    remainingBucket: plan.remainingBucket,
    newBagPending: plan.newBagPending,
  },
  reminders: {
    enabled: plan.remindersEnabled,
    leadDays: plan.leadDays,
    channels: plan.reminderChannels.map((channel) => channel.toLowerCase()),
  },
  activeOrder: plan.activeOrder
    ? {
        id: plan.activeOrder.id,
        number: plan.activeOrder.number,
        fulfillmentStatus: plan.activeOrder.status,
      }
    : null,
  updatedAt: plan.updatedAt.toISOString(),
});

const estimatedDaysRemaining = (plan: ReplenishmentPlan): number =>
  Math.max(
    0,
    Math.ceil(
      (plan.estimatedDepletionDate.getTime() - Date.now()) /
        (24 * 60 * 60 * 1000),
    ),
  );

const consumptionStatus = (plan: ReplenishmentPlan): string => {
  if (!plan.productId || !plan.variantId) return 'UNCONFIGURED';
  if (plan.newBagPending) return 'NEW_BAG_PENDING';
  const days = estimatedDaysRemaining(plan);
  if (days === 0) return 'DEPLETED';
  if (days <= 3) return 'URGENT';
  if (days <= plan.leadDays) return 'SOON';
  return 'GOOD';
};
