import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  AbandonedCartRecord,
  NotificationChannel,
  NotificationConsentRecord,
  NotificationRepository,
  ReminderPlanRecord,
} from '../domain/notification.repository';

const consentSelect = { id: true, destination: true } as const;
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

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  public constructor(private readonly prisma: PrismaService) {}

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
