import { createHash } from 'node:crypto';
import type { NotificationProvider } from '../../../shared/application/ports/notification-provider.interface';
import { DomainError } from '../../../shared/domain/domain-error';
import type {
  DeviceTokenRecord,
  InAppNotificationList,
  InAppNotificationRecord,
  MobileNotificationPreferences,
  NotificationPreferences,
  NotificationRepository,
} from '../domain/notification.repository';

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

  public getPreferences(customerId: string) {
    return this.repository.getPreferences(customerId);
  }

  public updatePreferences(customerId: string, input: NotificationPreferences) {
    return this.repository.updatePreferences(customerId, input);
  }

  public getMobilePreferences(customerId: string) {
    return this.repository.getMobilePreferences(customerId);
  }

  public updateMobilePreferences(customerId: string, input: Partial<MobileNotificationPreferences>) {
    return this.repository.updateMobilePreferences(customerId, input);
  }

  public registerDeviceToken(input: { customerId: string; token: string; platform: string; appVersion?: string | null }) {
    if (!input.token.trim()) throw new NotificationValidationError('El token del dispositivo es obligatorio.');
    if (!['ios', 'android'].includes(input.platform.toLowerCase()))
      throw new NotificationValidationError('La plataforma del dispositivo no es válida.');
    return this.repository.registerDeviceToken({
      ...input,
      token: input.token.trim(),
      platform: input.platform.toLowerCase(),
    });
  }

  public async registerMobileDeviceToken(input: {
    customerId: string;
    token: string;
    platform: string;
    provider?: string;
    deviceId: string;
    appVersion?: string | null;
  }): Promise<DeviceTokenRecord> {
    const token = input.token.trim();
    const deviceId = input.deviceId.trim();
    const provider = (input.provider ?? 'EXPO').trim().toUpperCase();
    const platform = input.platform.trim().toLowerCase();
    if (!token) {
      throw new NotificationValidationError('El token del dispositivo es obligatorio.');
    }
    if (!deviceId) {
      throw new NotificationValidationError('El identificador del dispositivo es obligatorio.');
    }
    if (!['ios', 'android'].includes(platform)) {
      throw new NotificationValidationError('La plataforma del dispositivo no es válida.');
    }
    if (!provider) {
      throw new NotificationValidationError('El proveedor del dispositivo es obligatorio.');
    }
    return this.repository.registerMobileDeviceToken({
      customerId: input.customerId,
      token,
      platform,
      provider,
      deviceIdHash: hashDeviceId(deviceId),
      appVersion: input.appVersion?.trim() || null,
    });
  }

  public deactivateDeviceToken(customerId: string, id: string) {
    return this.repository.deactivateDeviceToken(customerId, id);
  }

  public listInAppNotifications(
    customerId: string,
    input?: { unreadOnly?: boolean; cursor?: string; limit?: number },
  ): Promise<InAppNotificationList> {
    return this.repository.listInAppNotifications(customerId, input);
  }

  public async readInAppNotification(customerId: string, id: string): Promise<InAppNotificationRecord> {
    const notification = await this.repository.markInAppNotificationRead(customerId, id);
    if (!notification) throw new NotificationNotFoundError('La notificación no existe para este cliente.');
    return notification;
  }

  public async readAllInAppNotifications(customerId: string) {
    const updated = await this.repository.markAllInAppNotificationsRead(customerId);
    return {
      updated,
      unreadCount: 0,
    };
  }

  public async emitInAppNotification(input: {
    customerId: string;
    type: string;
    title: string;
    body: string;
    targetType?: string | null;
    targetId?: string | null;
    preference?: 'orderUpdates' | 'replenishmentReminders';
  }): Promise<InAppNotificationRecord | null> {
    if (input.preference) {
      const preferences = await this.getMobilePreferences(input.customerId);
      if (!preferences[input.preference]) return null;
    }
    if (!input.type.trim() || !input.title.trim() || !input.body.trim())
      throw new NotificationValidationError('Una notificación requiere tipo, título y contenido.');
    return this.repository.createInAppNotification({
      customerId: input.customerId,
      type: input.type.trim(),
      title: input.title.trim(),
      body: input.body.trim(),
      targetType: input.targetType?.trim() || null,
      targetId: input.targetId?.trim() || null,
    });
  }

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

  public async unsubscribe(input: { customerId?: string; guestTokenHash?: string; channel: 'EMAIL' | 'WHATSAPP' }) {
    this.assertOwner(input);
    await this.repository.unsubscribe(input);
    return { unsubscribed: true };
  }

  public async processAbandonedCarts(windowMinutes = 120) {
    const carts = await this.repository.listAbandonedCarts(new Date(Date.now() - windowMinutes * 60_000));
    let processed = 0;
    for (const cart of carts) {
      await this.repository.markCartAbandoned(cart.id, new Date());
      const destination = cart.contactPhone || cart.contactEmail;
      const channel = cart.contactPhone ? 'WHATSAPP' : cart.contactEmail ? 'EMAIL' : null;
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
          idempotencyKey,
        });
        await this.repository.markSent(deliveryId, result.providerMessageId);
        processed += 1;
      } catch (error) {
        await this.repository.markFailed(deliveryId, error instanceof Error ? error.message : 'Proveedor no disponible');
      }
    }
    return { scanned: carts.length, notified: processed };
  }

  public async processOrderConfirmations() {
    const deliveries = await this.repository.listDueOrderConfirmations(new Date());
    let sent = 0;
    for (const delivery of deliveries) {
      const guestToken =
        delivery.customerId || delivery.paymentStatus !== 'PAID'
          ? undefined
          : await this.repository.createGuestOrderActivationToken(delivery.orderId, delivery.email);
      const status = delivery.paymentStatus === 'PAID' ? 'approved' : delivery.paymentStatus === 'FAILED' ? 'failed' : 'pending';
      try {
        const result = await this.provider.send({
          channel: 'EMAIL',
          destination: delivery.email,
          template: 'order_confirmation',
          idempotencyKey: delivery.idempotencyKey,
          variables: {
            status,
            customerName: delivery.customerName,
            orderNumber: delivery.orderNumber,
            orderDate: delivery.orderDate.toLocaleString('es-AR'),
            paymentStatus: delivery.paymentStatus,
            paymentMethod: delivery.paymentMethod,
            items: JSON.stringify(delivery.items),
            subtotal: delivery.subtotal,
            discount: delivery.discount,
            shipping: delivery.shipping,
            total: delivery.total,
            address: delivery.address,
            deliveryEstimate: delivery.deliveryEstimate,
            ...(guestToken ? { token: guestToken } : { actionUrl: `/mi-cuenta/pedidos/${delivery.orderId}` }),
            actionLabel: guestToken
              ? 'Crear mi cuenta y ver mi pedido'
              : status === 'failed'
                ? 'Revisar pago'
                : status === 'pending'
                  ? 'Consultar estado'
                  : 'Ver mi pedido',
            orderId: delivery.orderId,
          },
        });
        await this.repository.markDeliveryAttempt(delivery.id, true, undefined, result.providerMessageId);
        sent += 1;
      } catch (error) {
        await this.repository.markDeliveryAttempt(delivery.id, false, error instanceof Error ? error.message : 'Proveedor no disponible');
      }
    }
    return { scanned: deliveries.length, sent };
  }

  public retryOrderConfirmation(orderId: string) {
    return this.repository.retryOrderConfirmation(orderId);
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
          idempotencyKey,
        });
        const next = new Date(plan.estimatedDepletionDate);
        next.setUTCDate(next.getUTCDate() + plan.durationDaysMax - 5);
        await this.repository.markSent(deliveryId, result.providerMessageId);
        await this.repository.advancePlan(plan.id, next);
        notified += 1;
      } catch (error) {
        await this.repository.markFailed(deliveryId, error instanceof Error ? error.message : 'Proveedor no disponible');
      }
    }
    return { scanned: plans.length, notified };
  }

  public async processReminderSubscriptions() {
    const reminders = await this.repository.listDueReminderSubscriptions(new Date());
    let notified = 0;
    for (const reminder of reminders) {
      const cycle = reminder.nextReminderAt.toISOString().slice(0, 10);
      const idempotencyKey = `replenishment-reminder-subscription:${reminder.id}:${cycle}`;
      if (await this.repository.hasDelivery(idempotencyKey)) continue;
      const deliveryId = await this.repository.createDelivery({
        channel: 'EMAIL',
        idempotencyKey,
        destinationHash: hash(reminder.email),
        replenishmentReminderId: reminder.id,
        customerId: reminder.customerId,
        template: 'replenishment_reminder',
      });
      try {
        const result = await this.provider.send({
          channel: 'EMAIL',
          destination: reminder.email,
          template: 'replenishment_reminder',
          variables: { planId: reminder.estimateId, petName: reminder.petName },
          idempotencyKey,
        });
        const next = new Date(reminder.nextReminderAt);
        next.setUTCDate(next.getUTCDate() + reminder.durationDaysMax);
        await this.repository.markSent(deliveryId, result.providerMessageId);
        await this.repository.advanceReminderSubscription(reminder.id, next);
        notified += 1;
      } catch (error) {
        await this.repository.markFailed(deliveryId, error instanceof Error ? error.message : 'Proveedor no disponible');
      }
    }
    return { scanned: reminders.length, notified };
  }

  public async processPurchaseScheduleReminders() {
    const schedules = await this.repository.listDuePurchaseSchedules(new Date());
    let notified = 0;
    for (const schedule of schedules) {
      const consent = await this.repository.findConsentForOwner({
        channel: 'EMAIL',
        customerId: schedule.customerId,
      });
      if (!consent) continue;
      const cycle = schedule.nextReminderAt.toISOString().slice(0, 10);
      const idempotencyKey = `purchase-schedule-reminder:${schedule.id}:${cycle}`;
      if (await this.repository.hasDelivery(idempotencyKey)) continue;
      const deliveryId = await this.repository.createDelivery({
        channel: 'EMAIL',
        idempotencyKey,
        destinationHash: hash(consent.destination),
        customerId: schedule.customerId,
        template: 'replenishment_reminder',
      });
      try {
        const result = await this.provider.send({
          channel: 'EMAIL',
          destination: consent.destination,
          template: 'replenishment_reminder',
          variables: { planId: schedule.id, petName: schedule.productName },
          idempotencyKey,
        });
        await this.repository.markSent(deliveryId, result.providerMessageId);
        await this.repository.markPurchaseScheduleAwaitingConfirmation(schedule.id);
        notified += 1;
      } catch (error) {
        await this.repository.markFailed(deliveryId, error instanceof Error ? error.message : 'Proveedor no disponible');
      }
    }
    return { scanned: schedules.length, notified };
  }

  private assertOwner(input: { customerId?: string; guestTokenHash?: string }): void {
    if (!input.customerId && !input.guestTokenHash) throw new NotificationValidationError('Se requiere autenticación o token de pedido.');
  }
}

export class NotificationNotFoundError extends DomainError {
  public constructor(message: string) {
    super(message, 'NOTIFICATION_NOT_FOUND');
  }
}

const hash = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex');

const hashDeviceId = (value: string) => createHash('sha256').update(value.trim()).digest('hex');
