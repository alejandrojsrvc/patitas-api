import { createHash } from 'node:crypto';
import { NotificationService } from '../../../src/modules/notifications/application/notification.service';
import type { NotificationRepository } from '../../../src/modules/notifications/domain/notification.repository';
import type { NotificationProvider } from '../../../src/shared/application/ports/notification-provider.interface';

describe('NotificationService mobile operations', () => {
  const provider = { send: jest.fn() } as unknown as NotificationProvider;

  it('hashes deviceId and returns a resource without the token', async () => {
    const registerMobileDeviceToken = jest.fn().mockResolvedValue({
      id: 'device-id',
      platform: 'ios',
      provider: 'EXPO',
      appVersion: '1.0.0',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
    });
    const repository = {
      registerMobileDeviceToken,
    } as unknown as NotificationRepository;
    const service = new NotificationService(repository, provider);

    const result = await service.registerMobileDeviceToken({
      customerId: 'customer-id',
      token: ' expo-token ',
      platform: 'IOS',
      deviceId: ' device-123 ',
    });

    expect(registerMobileDeviceToken).toHaveBeenCalledWith({
      customerId: 'customer-id',
      token: 'expo-token',
      platform: 'ios',
      provider: 'EXPO',
      deviceIdHash: createHash('sha256').update('device-123').digest('hex'),
      appVersion: null,
    });
    expect(result).not.toHaveProperty('token');
    expect(result).toMatchObject({ id: 'device-id', provider: 'EXPO' });
  });

  it('does not mark a notification belonging to another customer as read', async () => {
    const markInAppNotificationRead = jest.fn().mockResolvedValue(null);
    const repository = {
      markInAppNotificationRead,
    } as unknown as NotificationRepository;
    const service = new NotificationService(repository, provider);

    await expect(
      service.readInAppNotification('customer-id', 'notification-id'),
    ).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
    expect(markInAppNotificationRead).toHaveBeenCalledWith(
      'customer-id',
      'notification-id',
    );
  });

  it('marks all unread notifications idempotently', async () => {
    const markAllInAppNotificationsRead = jest
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    const repository = {
      markAllInAppNotificationsRead,
    } as unknown as NotificationRepository;
    const service = new NotificationService(repository, provider);

    await expect(
      service.readAllInAppNotifications('customer-id'),
    ).resolves.toEqual({ updated: 2, unreadCount: 0 });
    await expect(
      service.readAllInAppNotifications('customer-id'),
    ).resolves.toEqual({ updated: 0, unreadCount: 0 });
  });

  it('does not emit a categorized notification when its preference is disabled', async () => {
    const createInAppNotification = jest.fn();
    const repository = {
      getMobilePreferences: jest.fn().mockResolvedValue({
        push: true,
        email: true,
        whatsapp: false,
        orderUpdates: false,
        replenishmentReminders: true,
      }),
      createInAppNotification,
    } as unknown as NotificationRepository;
    const service = new NotificationService(repository, provider);

    await expect(
      service.emitInAppNotification({
        customerId: 'customer-id',
        type: 'ORDER_STATUS_CHANGED',
        title: 'Pedido actualizado',
        body: 'Tu pedido está en camino.',
        targetType: 'ORDER',
        targetId: 'order-id',
        preference: 'orderUpdates',
      }),
    ).resolves.toBeNull();
    expect(createInAppNotification).not.toHaveBeenCalled();
  });
});
