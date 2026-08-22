import { createHash } from 'node:crypto';
import type { NotificationProvider } from '../../../shared/application/ports/notification-provider.interface';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DomainError } from '../../../shared/domain/domain-error';

export class NotificationValidationError extends DomainError { public constructor(message: string) { super(message, 'NOTIFICATION_VALIDATION_FAILED'); } }

export class NotificationService {
  public constructor(private readonly prisma: PrismaService, private readonly provider: NotificationProvider) {}

  public async recordConsent(input: { customerId?: string; guestTokenHash?: string; channel: 'EMAIL' | 'WHATSAPP'; destination: string; version: string }) {
    if (!input.customerId && !input.guestTokenHash) throw new NotificationValidationError('Se requiere autenticación o token de pedido.');
    const db = this.prisma as any;
    const where = { channel: input.channel, destination: input.destination.trim(), ...(input.customerId ? { customerId: input.customerId } : { guestTokenHash: input.guestTokenHash }) };
    const current = await db.communicationConsent.findFirst({ where });
    return current ? db.communicationConsent.update({ where: { id: current.id }, data: { consentAt: new Date(), version: input.version.trim(), unsubscribedAt: null } }) : db.communicationConsent.create({ data: { ...where, consentAt: new Date(), version: input.version.trim() } });
  }

  public async unsubscribe(input: { customerId?: string; guestTokenHash?: string; channel: 'EMAIL' | 'WHATSAPP' }) {
    if (!input.customerId && !input.guestTokenHash) throw new NotificationValidationError('Se requiere autenticación o token de pedido.');
    const db = this.prisma as any;
    await db.communicationConsent.updateMany({ where: { channel: input.channel, ...(input.customerId ? { customerId: input.customerId } : { guestTokenHash: input.guestTokenHash }) }, data: { unsubscribedAt: new Date() } });
    await db.replenishmentPlan.updateMany({ where: { channel: input.channel, ...(input.customerId ? { customerId: input.customerId } : { guestAccessTokenHash: input.guestTokenHash }) }, data: { unsubscribedAt: new Date(), status: 'PAUSED' } });
    return { unsubscribed: true };
  }

  public async processAbandonedCarts(windowMinutes = 120) {
    const db = this.prisma as any;
    const cutoff = new Date(Date.now() - windowMinutes * 60_000);
    const carts = await db.cart.findMany({ where: { status: 'ACTIVE', lastActivityAt: { lt: cutoff } }, include: { checkoutSession: true, items: { include: { variant: true } } }, take: 100 });
    let processed = 0;
    for (const cart of carts) {
      await db.cart.update({ where: { id: cart.id }, data: { status: 'ABANDONED', abandonedAt: new Date() } });
      const session = cart.checkoutSession;
      const destination = session?.contactPhone || session?.contactEmail;
      const channel = session?.contactPhone ? 'WHATSAPP' : session?.contactEmail ? 'EMAIL' : null;
      if (!destination || !channel) continue;
      const consent = await db.communicationConsent.findFirst({ where: { channel, destination, unsubscribedAt: null } });
      if (!consent) continue;
      const idempotencyKey = `abandoned-cart:${cart.id}`;
      const prior = await db.notificationDelivery.findUnique({ where: { idempotencyKey } });
      if (prior) continue;
      const delivery = await db.notificationDelivery.create({ data: { channel, template: 'abandoned_cart', destinationHash: hash(destination), idempotencyKey, cartId: cart.id, checkoutSessionId: session?.id ?? null, customerId: cart.customerId, attemptCount: 1 } });
      try {
        const result = await this.provider.send({ channel, destination, template: 'abandoned_cart', variables: { cartId: cart.id } });
        await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', providerMessageId: result.providerMessageId ?? null } });
        processed += 1;
      } catch (error) {
        await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'Proveedor no disponible' } });
      }
    }
    return { scanned: carts.length, notified: processed };
  }

  public async processPlanReminders() {
    const db = this.prisma as any;
    const plans = await db.replenishmentPlan.findMany({ where: { status: 'ACTIVE', unsubscribedAt: null, nextReminderAt: { lte: new Date() } }, take: 100 });
    let notified = 0;
    for (const plan of plans) {
      const consent = await db.communicationConsent.findFirst({ where: { channel: plan.channel, ...(plan.customerId ? { customerId: plan.customerId } : { guestTokenHash: plan.guestAccessTokenHash }), unsubscribedAt: null } });
      if (!consent) { await db.replenishmentPlan.update({ where: { id: plan.id }, data: { status: 'PAUSED', unsubscribedAt: new Date() } }); continue; }
      const idempotencyKey = `replenishment-reminder:${plan.id}:${new Date(plan.nextReminderAt).toISOString().slice(0, 10)}`;
      if (await db.notificationDelivery.findUnique({ where: { idempotencyKey } })) continue;
      const delivery = await db.notificationDelivery.create({ data: { channel: plan.channel, template: 'replenishment_reminder', destinationHash: hash(consent.destination), idempotencyKey, planId: plan.id, customerId: plan.customerId, attemptCount: 1 } });
      try {
        const result = await this.provider.send({ channel: plan.channel, destination: consent.destination, template: 'replenishment_reminder', variables: { planId: plan.id, petName: plan.petName } });
        const next = new Date(plan.estimatedDepletionDate); next.setDate(next.getDate() + plan.durationDaysMax); next.setDate(next.getDate() - 5);
        await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', providerMessageId: result.providerMessageId ?? null } });
        await db.replenishmentPlan.update({ where: { id: plan.id }, data: { nextReminderAt: next } });
        notified += 1;
      } catch (error) { await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'Proveedor no disponible' } }); }
    }
    return { scanned: plans.length, notified };
  }
}

const hash = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
