export type ReplenishmentReminderStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export interface ReplenishmentReminderOwner {
  customerId?: string | null;
  guestTokenHash?: string | null;
}

export interface ReplenishmentReminder {
  id: string;
  customerId: string | null;
  guestTokenHash: string | null;
  estimateId: string;
  email: string;
  consentVersion: string;
  nextReminderAt: Date;
  status: ReplenishmentReminderStatus;
  createdAt: Date;
  updatedAt: Date;
}
