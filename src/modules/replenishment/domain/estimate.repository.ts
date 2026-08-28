import type {
  CreateEstimateInput,
  ReplenishmentEstimate,
} from './estimate.types';

export const REPLENISHMENT_ESTIMATE_REPOSITORY = Symbol(
  'REPLENISHMENT_ESTIMATE_REPOSITORY',
);

export interface ReplenishmentEstimateRepository {
  create(input: {
    customerId: string;
    petId?: string | null;
    request: CreateEstimateInput;
    result: {
      dailyGrams: { min: number; max: number };
      durationDays: { min: number; max: number };
      source: string;
      sourceLabel: string;
      sourceUrl: string | null;
      estimatedDepletionDate: Date;
      assumptions: string[];
    };
  }): Promise<ReplenishmentEstimate>;
  findOwned(
    id: string,
    customerId: string,
  ): Promise<ReplenishmentEstimate | null>;
}
