export type ReplenishmentPlanStatus =
  'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
export type NotificationChannel = 'EMAIL' | 'WHATSAPP' | 'PUSH';
export type RemainingBucket = 'FEW_DAYS' | 'ABOUT_WEEK' | 'MORE_THAN_WEEK';

export interface ReplenishmentOwner {
  customerId?: string;
  guestTokenHash?: string;
}

export interface CreateReplenishmentPlanInput {
  orderId?: string | null;
  petId?: string | null;
  estimateId?: string | null;
  idempotencyKey?: string | null;
  guestAccessTokenHash?: string | null;
  petName: string;
  petSpecies: string;
  petWeightKg: string;
  petLifeStage: string;
  petBreed?: string | null;
  productId: string;
  variantId: string;
  dailyConsumption: string;
  dailyGramsMin?: number | null;
  dailyGramsMax?: number | null;
  consumptionUnit: string;
  durationDaysMin: number;
  durationDaysMax: number;
  calculationSource: string;
  estimatedDepletionDate: Date;
  channel: NotificationChannel;
  reminderChannels?: NotificationChannel[];
  consentVersion: string;
  destination: string;
  remindersEnabled?: boolean;
  leadDays?: number;
  bagStartedAt?: Date | null;
  remainingBucket?: string | null;
}

export interface MobileReplenishmentPlanUpdate {
  status?: ReplenishmentPlanStatus;
  nextReminderAt?: Date | null;
  remindersEnabled?: boolean;
  leadDays?: number;
}

export interface ReplenishmentPlan {
  id: string;
  customerId: string | null;
  orderId: string | null;
  petId: string | null;
  estimateId: string | null;
  petName: string;
  petSpecies: string;
  petWeightKg: string;
  petLifeStage: string;
  petBreed: string | null;
  productId: string;
  variantId: string;
  weightGrams: number | null;
  productName: string | null;
  salePrice: string | null;
  sku: string | null;
  presentation: string | null;
  dailyConsumption: string;
  dailyGramsMin?: number | null;
  dailyGramsMax?: number | null;
  consumptionUnit: string;
  durationDaysMin: number;
  durationDaysMax: number;
  calculationSource: string;
  estimatedDepletionDate: Date;
  nextReminderAt: Date | null;
  channel: NotificationChannel;
  reminderChannels: NotificationChannel[];
  createdAt: Date;
  updatedAt: Date;
  status: ReplenishmentPlanStatus;
  needsReview: boolean;
  reviewReason: string | null;
  bagStartedAt: Date | null;
  remainingBucket: string | null;
  remindersEnabled: boolean;
  leadDays: number;
  newBagPending: boolean;
  activeOrder: {
    id: string;
    number: string | null;
    status: string;
    paymentStatus: string;
    total: string;
    createdAt: Date;
  } | null;
}
