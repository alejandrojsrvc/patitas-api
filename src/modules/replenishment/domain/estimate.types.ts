export interface CreateEstimateInput {
  pet: {
    id?: string;
    name: string;
    species: string;
    weightKg: number;
    lifeStage: string;
    breed?: string | null;
  };
  food: {
    productId?: string;
    variantId?: string;
    custom?: {
      brand: string;
      name: string;
      weightGrams: number;
    };
  };
}

export interface ReplenishmentEstimate {
  id: string;
  dailyGrams: { min: number; max: number };
  durationDays: { min: number; max: number };
  source: string;
  sourceLabel: string;
  sourceUrl: string | null;
  estimatedDepletionDate: Date;
  assumptions: string[];
  productId: string | null;
  variantId: string | null;
  custom: {
    brand: string;
    name: string;
    weightGrams: number;
  } | null;
}
