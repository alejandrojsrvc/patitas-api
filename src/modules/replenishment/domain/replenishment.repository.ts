import type {
  CreateReplenishmentPlanInput,
  ReplenishmentOwner,
  ReplenishmentPlan,
  ReplenishmentPlanStatus,
} from './replenishment.types';

export const REPLENISHMENT_REPOSITORY = Symbol('REPLENISHMENT_REPOSITORY');

export interface ReplenishmentRepository {
  create(
    input: CreateReplenishmentPlanInput,
    owner: ReplenishmentOwner,
  ): Promise<ReplenishmentPlan>;
  updateSchedule(
    id: string,
    owner: ReplenishmentOwner,
    nextReminderAt: Date,
  ): Promise<ReplenishmentPlan>;
  recalibrate(
    id: string,
    owner: ReplenishmentOwner,
    days: number,
  ): Promise<ReplenishmentPlan>;
  list(owner: ReplenishmentOwner): Promise<ReplenishmentPlan[]>;
  find(id: string, owner: ReplenishmentOwner): Promise<ReplenishmentPlan>;
  setStatus(
    id: string,
    owner: ReplenishmentOwner,
    status: ReplenishmentPlanStatus,
  ): Promise<ReplenishmentPlan>;
  createReorderCart(
    id: string,
    owner: ReplenishmentOwner,
    options?: { anonymousToken?: boolean },
  ): Promise<{ cartId: string; cartToken: string | null; status: string }>;
}
