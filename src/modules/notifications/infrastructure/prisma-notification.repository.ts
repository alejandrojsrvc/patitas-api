import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  AbandonedCartRecord,
  DeviceTokenRecord,
  InAppNotificationList,
  InAppNotificationRecord,
  NotificationChannel,
  NotificationConsentRecord,
  MobileNotificationPreferences,
  NotificationPreferences,
  NotificationRepository,
  ReminderPlanRecord,
} from '../domain/notification.repository';
import { NotificationQueryError } from '../domain/notification.repository';

const consentSelect = { id: true, destination: true } as const;
const deviceTokenSelect = {
  id: true,
  platform: true,
  provider: true,
  appVersion: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  lastSeenAt: true,
} as const;
const inAppNotificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  targetType: true,
  targetId: true,
  readAt: true,
  createdAt: true,
} as const;
const planSelect = {
  id: true,
  customerId: true,
  guestAccessTokenHash: true,
  channel: true,
  nextReminderAt: true,
  estimatedDepletionDate: true,
  durationDaysMax: true,
  petName: true,
} as const;
type PlanRecord = Prisma.ReplenishmentPlanGetPayload<{
  select: typeof planSelect;
}>;
type DeviceTokenRecordValue = Prisma.DeviceTokenGetPayload<{
  select: typeof deviceTokenSelect;
}>;
type InAppNotificationRecordValue = Prisma.InAppNotificationGetPayload<{
  select: typeof inAppNotificationSelect;
}>;

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async getPreferences(
    customerId: string,
  ): Promise<NotificationPreferences> {
    const value = await this.prisma.customerNotificationPreference.findUnique({
      where: { customerId },
    });
    return {
      push: value?.push ?? false,
      email: value?.email ?? true,
      whatsapp: value?.whatsapp ?? false,
    };
  }

  public async updatePreferences(
    customerId: string,
    input: NotificationPreferences,
  ) {
    const value = await this.prisma.customerNotificationPreference.upsert({
      where: { customerId },
      create: { customerId, ...input },
      update: input,
    });
    return { push: value.push, email: value.email, whatsapp: value.whatsapp };
  }

  public async getMobilePreferences(
    customerId: string,
  ): Promise<MobileNotificationPreferences> {
    const value = await this.prisma.customerNotificationPreference.findUnique({
      where: { customerId },
    });
    return {
      push: value?.push ?? false,
      email: value?.email ?? true,
      whatsapp: value?.whatsapp ?? false,
      orderUpdates: value?.orderUpdates ?? true,
      replenishmentReminders: value?.replenishmentReminders ?? true,
    };
  }

  public async updateMobilePreferences(
    customerId: string,
    input: Partial<MobileNotificationPreferences>,
  ): Promise<MobileNotificationPreferences> {
    const value = await this.prisma.customerNotificationPreference.upsert({
      where: { customerId },
      create: {
        customerId,
        push: input.push ?? false,
        email: input.email ?? true,
        whatsapp: input.whatsapp ?? false,
        orderUpdates: input.orderUpdates ?? true,
        replenishmentReminders: input.replenishmentReminders ?? true,
      },
      update: input,
    });
    return {
      push: value.push,
      email: value.email,
      whatsapp: value.whatsapp,
      orderUpdates: value.orderUpdates,
      replenishmentReminders: value.replenishmentReminders,
    };
  }

  public async registerDeviceToken(input: {
    customerId: string;
    token: string;
    platform: string;
    appVersion?: string | null;
  }): Promise<void> {
    await this.upsertDeviceToken(input);
  }

  public registerMobileDeviceToken(input: {
    customerId: string;
    token: string;
    platform: string;
    provider: string;
    deviceIdHash: string;
    appVersion?: string | null;
  }): Promise<DeviceTokenRecord> {
    return this.upsertDeviceToken(input);
  }

  private async upsertDeviceToken(input: {
    customerId: string;
    token: string;
    platform: string;
    provider?: string;
    deviceIdHash?: string | null;
    appVersion?: string | null;
  }): Promise<DeviceTokenRecord> {
    const existing = input.deviceIdHash
      ? await this.prisma.deviceToken.findFirst({
          where: {
            customerId: input.customerId,
            provider: input.provider ?? 'EXPO',
            deviceIdHash: input.deviceIdHash,
          },
          orderBy: { updatedAt: 'desc' },
          select: deviceTokenSelect,
        })
      : await this.prisma.deviceToken.findUnique({
          where: {
            customerId_token: {
              customerId: input.customerId,
              token: input.token,
            },
          },
          select: deviceTokenSelect,
        });
    const data = {
      platform: input.platform,
      provider: input.provider ?? 'EXPO',
      appVersion: input.appVersion ?? null,
      active: true,
      lastSeenAt: new Date(),
      ...(input.deviceIdHash !== undefined
        ? { deviceIdHash: input.deviceIdHash }
        : {}),
    };
    const value = existing
      ? await this.prisma.deviceToken.update({
          where: { id: existing.id },
          data: { token: input.token, ...data },
          select: deviceTokenSelect,
        })
      : await this.prisma.deviceToken.upsert({
          where: {
            customerId_token: {
              customerId: input.customerId,
              token: input.token,
            },
          },
          create: {
            customerId: input.customerId,
            token: input.token,
            ...data,
          },
          update: data,
          select: deviceTokenSelect,
        });
    return mapDeviceToken(value);
  }

  public async deactivateDeviceToken(
    customerId: string,
    id: string,
  ): Promise<void> {
    await this.prisma.deviceToken.updateMany({
      where: { id, customerId },
      data: { active: false },
    });
  }

  public async listInAppNotifications(
    customerId: string,
    input: { unreadOnly?: boolean; cursor?: string; limit?: number } = {},
  ): Promise<InAppNotificationList> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const cursor = decodeNotificationCursor(input.cursor);
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.inAppNotification.findMany({
        where: {
          customerId,
          ...(input.unreadOnly ? { readAt: null } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
        select: inAppNotificationSelect,
      }),
      this.prisma.inAppNotification.count({
        where: { customerId, readAt: null },
      }),
    ]);
    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;
    return {
      items: page.map(mapInAppNotification),
      unreadCount,
      nextCursor: hasNext
        ? Buffer.from(page[page.length - 1].id, 'utf8').toString('base64url')
        : null,
    };
  }

  public async markInAppNotificationRead(
    customerId: string,
    id: string,
  ): Promise<InAppNotificationRecord | null> {
    await this.prisma.inAppNotification.updateMany({
      where: { id, customerId, readAt: null },
      data: { readAt: new Date() },
    });
    const value = await this.prisma.inAppNotification.findFirst({
      where: { id, customerId },
      select: inAppNotificationSelect,
    });
    return value ? mapInAppNotification(value) : null;
  }

  public markAllInAppNotificationsRead(customerId: string): Promise<number> {
    return this.prisma.inAppNotification
      .updateMany({
        where: { customerId, readAt: null },
        data: { readAt: new Date() },
      })
      .then((result) => result.count);
  }

  public async createInAppNotification(input: {
    customerId: string;
    type: string;
    title: string;
    body: string;
    targetType?: string | null;
    targetId?: string | null;
  }): Promise<InAppNotificationRecord> {
    const value = await this.prisma.inAppNotification.create({
      data: {
        customerId: input.customerId,
        type: input.type,
        title: input.title,
        body: input.body,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
      },
      select: inAppNotificationSelect,
    });
    return mapInAppNotification(value);
  }

  public async upsertConsent(input: {
    customerId?: string;
    guestTokenHash?: string;
    channel: NotificationChannel;
    destination: string;
    version: string;
  }): Promise<NotificationConsentRecord> {
    const where: Prisma.CommunicationConsentWhereInput = {
      channel: input.channel,
      destination: input.destination,
      ...(input.customerId
        ? { customerId: input.customerId }
        : { guestTokenHash: input.guestTokenHash }),
    };
    const current = await this.prisma.communicationConsent.findFirst({
      where,
      select: consentSelect,
    });
    if (current) {
      return this.prisma.communicationConsent.update({
        where: { id: current.id },
        data: {
          consentAt: new Date(),
          version: input.version,
          unsubscribedAt: null,
        },
        select: consentSelect,
      });
    }
    return this.prisma.communicationConsent.create({
      data: {
        channel: input.channel,
        destination: input.destination,
        consentAt: new Date(),
        version: input.version,
        customerId: input.customerId,
        guestTokenHash: input.guestTokenHash,
      },
      select: consentSelect,
    });
  }

  public async unsubscribe(input: {
    customerId?: string;
    guestTokenHash?: string;
    channel: NotificationChannel;
  }): Promise<void> {
    const owner = input.customerId
      ? { customerId: input.customerId }
      : { guestTokenHash: input.guestTokenHash };
    await this.prisma.communicationConsent.updateMany({
      where: { channel: input.channel, ...owner },
      data: { unsubscribedAt: new Date() },
    });
    await this.prisma.replenishmentPlan.updateMany({
      where: {
        channel: input.channel,
        ...(input.customerId
          ? { customerId: input.customerId }
          : { guestAccessTokenHash: input.guestTokenHash }),
      },
      data: { unsubscribedAt: new Date(), status: 'PAUSED' },
    });
  }

  public async listAbandonedCarts(
    cutoff: Date,
  ): Promise<AbandonedCartRecord[]> {
    const carts = await this.prisma.cart.findMany({
      where: { status: 'ACTIVE', lastActivityAt: { lt: cutoff } },
      include: { checkoutSession: true },
      take: 100,
    });
    return carts.map((cart) => ({
      id: cart.id,
      customerId: cart.customerId,
      checkoutSessionId: cart.checkoutSession?.id ?? null,
      contactPhone: cart.checkoutSession?.contactPhone ?? null,
      contactEmail: cart.checkoutSession?.contactEmail ?? null,
    }));
  }

  public async markCartAbandoned(cartId: string, at: Date): Promise<void> {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { status: 'ABANDONED', abandonedAt: at },
    });
  }

  public findConsent(channel: NotificationChannel, destination: string) {
    return this.prisma.communicationConsent.findFirst({
      where: { channel, destination, unsubscribedAt: null },
      select: consentSelect,
    });
  }

  public findConsentForOwner(input: {
    channel: NotificationChannel;
    customerId?: string | null;
    guestTokenHash?: string | null;
  }) {
    return this.prisma.communicationConsent.findFirst({
      where: {
        channel: input.channel,
        unsubscribedAt: null,
        ...(input.customerId
          ? { customerId: input.customerId }
          : { guestTokenHash: input.guestTokenHash }),
      },
      select: consentSelect,
    });
  }

  public async hasDelivery(idempotencyKey: string): Promise<boolean> {
    return Boolean(
      await this.prisma.notificationDelivery.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      }),
    );
  }

  public async createDelivery(input: {
    channel: NotificationChannel;
    idempotencyKey: string;
    destinationHash: string;
    cartId?: string;
    checkoutSessionId?: string | null;
    planId?: string;
    customerId?: string | null;
  }): Promise<string> {
    const delivery = await this.prisma.notificationDelivery.create({
      data: {
        channel: input.channel,
        template: input.planId ? 'replenishment_reminder' : 'abandoned_cart',
        destinationHash: input.destinationHash,
        idempotencyKey: input.idempotencyKey,
        cartId: input.cartId,
        checkoutSessionId: input.checkoutSessionId,
        planId: input.planId,
        customerId: input.customerId,
        attemptCount: 1,
      },
      select: { id: true },
    });
    return delivery.id;
  }

  public async markSent(id: string, providerMessageId?: string): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: { status: 'SENT', providerMessageId },
    });
  }

  public async markFailed(id: string, message: string): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: { status: 'FAILED', error: message },
    });
  }

  public async listDuePlans(now: Date): Promise<ReminderPlanRecord[]> {
    const plans = await this.prisma.replenishmentPlan.findMany({
      where: {
        status: 'ACTIVE',
        unsubscribedAt: null,
        nextReminderAt: { lte: now },
      },
      select: planSelect,
      take: 100,
    });
    return plans.map(mapPlan);
  }

  public async pausePlan(id: string, at: Date): Promise<void> {
    await this.prisma.replenishmentPlan.update({
      where: { id },
      data: { status: 'PAUSED', unsubscribedAt: at },
    });
  }

  public async advancePlan(id: string, nextReminderAt: Date): Promise<void> {
    await this.prisma.replenishmentPlan.update({
      where: { id },
      data: { nextReminderAt },
    });
  }
}

const mapPlan = (value: PlanRecord): ReminderPlanRecord => ({
  id: value.id,
  customerId: value.customerId,
  guestAccessTokenHash: value.guestAccessTokenHash,
  channel: value.channel,
  nextReminderAt: value.nextReminderAt ?? value.estimatedDepletionDate,
  estimatedDepletionDate: value.estimatedDepletionDate,
  durationDaysMax: value.durationDaysMax,
  petName: value.petName,
});

const mapDeviceToken = (value: DeviceTokenRecordValue): DeviceTokenRecord => ({
  id: value.id,
  platform: value.platform,
  provider: value.provider,
  appVersion: value.appVersion,
  active: value.active,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
  lastSeenAt: value.lastSeenAt,
});

const mapInAppNotification = (
  value: InAppNotificationRecordValue,
): InAppNotificationRecord => ({
  id: value.id,
  type: value.type,
  title: value.title,
  body: value.body,
  targetType: value.targetType,
  targetId: value.targetId,
  readAt: value.readAt,
  createdAt: value.createdAt,
});

const decodeNotificationCursor = (cursor?: string): string | undefined => {
  if (!cursor) return undefined;
  try {
    const id = Buffer.from(cursor, 'base64url').toString('utf8');
    if (!id) throw new Error();
    return id;
  } catch {
    throw new NotificationQueryError(
      'El cursor de notificaciones no es válido.',
    );
  }
};
