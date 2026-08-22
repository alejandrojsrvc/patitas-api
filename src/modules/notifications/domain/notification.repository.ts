export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
export type NotificationChannel = 'EMAIL' | 'WHATSAPP';

export interface NotificationConsentRecord {
  id: string;
  destination: string;
}
export interface AbandonedCartRecord {
  id: string;
  customerId: string | null;
  checkoutSessionId: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}
export interface ReminderPlanRecord {
  id: string;
  customerId: string | null;
  guestAccessTokenHash: string | null;
  channel: NotificationChannel;
  nextReminderAt: Date;
  estimatedDepletionDate: Date;
  durationDaysMax: number;
  petName: string;
}
export interface NotificationRepository {
  upsertConsent(input: {
    customerId?: string;
    guestTokenHash?: string;
    channel: NotificationChannel;
    destination: string;
    version: string;
  }): Promise<NotificationConsentRecord>;
  unsubscribe(input: {
    customerId?: string;
    guestTokenHash?: string;
    channel: NotificationChannel;
  }): Promise<void>;
  listAbandonedCarts(cutoff: Date): Promise<AbandonedCartRecord[]>;
  markCartAbandoned(cartId: string, at: Date): Promise<void>;
  findConsent(
    channel: NotificationChannel,
    destination: string,
  ): Promise<NotificationConsentRecord | null>;
  findConsentForOwner(input: {
    channel: NotificationChannel;
    customerId?: string | null;
    guestTokenHash?: string | null;
  }): Promise<NotificationConsentRecord | null>;
  hasDelivery(idempotencyKey: string): Promise<boolean>;
  createDelivery(input: {
    channel: NotificationChannel;
    idempotencyKey: string;
    destinationHash: string;
    cartId?: string;
    checkoutSessionId?: string | null;
    planId?: string;
    customerId?: string | null;
  }): Promise<string>;
  markSent(id: string, providerMessageId?: string): Promise<void>;
  markFailed(id: string, message: string): Promise<void>;
  listDuePlans(now: Date): Promise<ReminderPlanRecord[]>;
  pausePlan(id: string, at: Date): Promise<void>;
  advancePlan(id: string, nextReminderAt: Date): Promise<void>;
}
