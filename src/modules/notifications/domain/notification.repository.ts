import { DomainError } from '../../../shared/domain/domain-error';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
export type NotificationChannel = 'EMAIL' | 'WHATSAPP' | 'PUSH';

export class NotificationQueryError extends DomainError {
  public constructor(message: string) {
    super(message, 'NOTIFICATION_QUERY_INVALID');
  }
}

export interface NotificationPreferences {
  push: boolean;
  email: boolean;
  whatsapp: boolean;
}

export interface MobileNotificationPreferences extends NotificationPreferences {
  orderUpdates: boolean;
  replenishmentReminders: boolean;
}

export interface DeviceTokenRecord {
  id: string;
  platform: string;
  provider: string;
  appVersion: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

export interface InAppNotificationRecord {
  id: string;
  type: string;
  title: string;
  body: string;
  targetType: string | null;
  targetId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface InAppNotificationList {
  items: InAppNotificationRecord[];
  unreadCount: number;
  nextCursor: string | null;
}

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
  getPreferences(customerId: string): Promise<NotificationPreferences>;
  updatePreferences(
    customerId: string,
    input: NotificationPreferences,
  ): Promise<NotificationPreferences>;
  getMobilePreferences(
    customerId: string,
  ): Promise<MobileNotificationPreferences>;
  updateMobilePreferences(
    customerId: string,
    input: Partial<MobileNotificationPreferences>,
  ): Promise<MobileNotificationPreferences>;
  registerDeviceToken(input: {
    customerId: string;
    token: string;
    platform: string;
    appVersion?: string | null;
  }): Promise<void>;
  registerMobileDeviceToken(input: {
    customerId: string;
    token: string;
    platform: string;
    provider: string;
    deviceIdHash: string;
    appVersion?: string | null;
  }): Promise<DeviceTokenRecord>;
  deactivateDeviceToken(customerId: string, id: string): Promise<void>;
  listInAppNotifications(
    customerId: string,
    input?: { unreadOnly?: boolean; cursor?: string; limit?: number },
  ): Promise<InAppNotificationList>;
  markInAppNotificationRead(
    customerId: string,
    id: string,
  ): Promise<InAppNotificationRecord | null>;
  markAllInAppNotificationsRead(customerId: string): Promise<number>;
  createInAppNotification(input: {
    customerId: string;
    type: string;
    title: string;
    body: string;
    targetType?: string | null;
    targetId?: string | null;
  }): Promise<InAppNotificationRecord>;
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
