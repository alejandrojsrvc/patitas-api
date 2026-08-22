import { createHash } from 'node:crypto';
import type { NotificationProvider } from '../../../shared/application/ports/notification-provider.interface';
import { DomainError } from '../../../shared/domain/domain-error';
import type { NotificationRepository } from '../domain/notification.repository';

export class NotificationValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'NOTIFICATION_VALIDATION_FAILED');
  }
}

export class NotificationService {
  public constructor(
    private readonly repository: NotificationRepository,
    private readonly provider: NotificationProvider,
  ) {}

  public async recordConsent(input: {
    customerId?: string;
    guestTokenHash?: string;
    channel: 'EMAIL' | 'WHATSAPP';
    destination: string;
    version: string;
  }) {
    this.assertOwner(input);
    return this.repository.upsertConsent({
      ...input,
      destination: input.destination.trim(),
      version: input.version.trim(),
    });
  }

  public async unsubscribe(input: {
    customerId?: string;
    guestTokenHash?: string;
    channel: 'EMAIL' | 'WHATSAPP';
  }) {
    this.assertOwner(input);
    await this.repository.unsubscribe(input);
    return { unsubscribed: true };
  }

  public async processAbandonedCarts(windowMinutes = 120) {
    const carts = await this.repository.listAbandonedCarts(
      new Date(Date.now() - windowMinutes * 60_000),
    );
    let processed = 0;
    for (const cart of carts) {
      await this.repository.markCartAbandoned(cart.id, new Date());
      const destination = cart.contactPhone || cart.contactEmail;
      const channel = cart.contactPhone
        ? 'WHATSAPP'
        : cart.contactEmail
          ? 'EMAIL'
          : null;
      if (!destination || !channel) continue;
      if (!(await this.repository.findConsent(channel, destination))) continue;
      const idempotencyKey = `abandoned-cart:${cart.id}`;
      if (await this.repository.hasDelivery(idempotencyKey)) continue;
      const deliveryId = await this.repository.createDelivery({
        channel,
        idempotencyKey,
        destinationHash: hash(destination),
        cartId: cart.id,
        checkoutSessionId: cart.checkoutSessionId,
        customerId: cart.customerId,
      });
      try {
        const result = await this.provider.send({
          channel,
          destination,
          template: 'abandoned_cart',
          variables: { cartId: cart.id },
        });
        await this.repository.markSent(deliveryId, result.providerMessageId);
        processed += 1;
      } catch (error) {
        await this.repository.markFailed(
          deliveryId,
          error instanceof Error ? error.message : 'Proveedor no disponible',
        );
      }
    }
    return { scanned: carts.length, notified: processed };
  }

  public async processPlanReminders() {
    const plans = await this.repository.listDuePlans(new Date());
    let notified = 0;
    for (const plan of plans) {
      const consent = await this.repository.findConsentForOwner({
        channel: plan.channel,
        customerId: plan.customerId,
        guestTokenHash: plan.guestAccessTokenHash,
      });
      if (!consent) {
        await this.repository.pausePlan(plan.id, new Date());
        continue;
      }
      const date = plan.nextReminderAt.toISOString().slice(0, 10);
      const idempotencyKey = `replenishment-reminder:${plan.id}:${date}`;
      if (await this.repository.hasDelivery(idempotencyKey)) continue;
      const deliveryId = await this.repository.createDelivery({
        channel: plan.channel,
        idempotencyKey,
        destinationHash: hash(consent.destination),
        planId: plan.id,
        customerId: plan.customerId,
      });
      try {
        const result = await this.provider.send({
          channel: plan.channel,
          destination: consent.destination,
          template: 'replenishment_reminder',
          variables: { planId: plan.id, petName: plan.petName },
        });
        const next = new Date(plan.estimatedDepletionDate);
        next.setDate(next.getDate() + plan.durationDaysMax - 5);
        await this.repository.markSent(deliveryId, result.providerMessageId);
        await this.repository.advancePlan(plan.id, next);
        notified += 1;
      } catch (error) {
        await this.repository.markFailed(
          deliveryId,
          error instanceof Error ? error.message : 'Proveedor no disponible',
        );
      }
    }
    return { scanned: plans.length, notified };
  }

  private assertOwner(input: {
    customerId?: string;
    guestTokenHash?: string;
  }): void {
    if (!input.customerId && !input.guestTokenHash)
      throw new NotificationValidationError(
        'Se requiere autenticación o token de pedido.',
      );
  }
}

const hash = (value: string) =>
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
