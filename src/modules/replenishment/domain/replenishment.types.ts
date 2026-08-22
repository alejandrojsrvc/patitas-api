export type ReplenishmentPlanStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
export type NotificationChannel = 'EMAIL' | 'WHATSAPP';

export interface ReplenishmentOwner { customerId?: string; guestTokenHash?: string }

export interface CreateReplenishmentPlanInput {
  orderId?: string | null;
  guestAccessTokenHash?: string | null;
  petName: string;
  petSpecies: string;
  petWeightKg: string;
  petLifeStage: string;
  petBreed?: string | null;
  productId: string;
  variantId: string;
  dailyConsumption: string;
  consumptionUnit: string;
  durationDaysMin: number;
  durationDaysMax: number;
  calculationSource: string;
  estimatedDepletionDate: Date;
  channel: NotificationChannel;
  consentVersion: string;
  destination: string;
}

export interface ReplenishmentPlan {
  id: string;
  customerId: string | null;
  orderId: string | null;
  petName: string;
  petSpecies: string;
  petWeightKg: string;
  petLifeStage: string;
  petBreed: string | null;
  productId: string;
  variantId: string;
  sku: string | null;
  presentation: string | null;
  dailyConsumption: string;
  consumptionUnit: string;
  durationDaysMin: number;
  durationDaysMax: number;
  calculationSource: string;
  estimatedDepletionDate: Date;
  nextReminderAt: Date | null;
  channel: NotificationChannel;
  status: ReplenishmentPlanStatus;
  needsReview: boolean;
  reviewReason: string | null;
}
