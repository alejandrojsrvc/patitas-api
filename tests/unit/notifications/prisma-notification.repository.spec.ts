import { PrismaNotificationRepository } from '../../../src/modules/notifications/infrastructure/prisma-notification.repository';
import type { PrismaService } from '../../../src/infrastructure/database/prisma.service';

describe('PrismaNotificationRepository mobile device tokens', () => {
  it('updates the idempotent device resource without selecting its token', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'device-id',
      platform: 'ios',
      provider: 'EXPO',
      appVersion: '1.0.0',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
    });
    const update = jest.fn().mockResolvedValue({
      id: 'device-id',
      platform: 'ios',
      provider: 'EXPO',
      appVersion: '1.0.0',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
    });
    const prisma = {
      deviceToken: { findFirst, update },
    } as unknown as PrismaService;
    const repository = new PrismaNotificationRepository(prisma);

    const result = await repository.registerMobileDeviceToken({
      customerId: 'customer-id',
      token: 'new-token',
      platform: 'ios',
      provider: 'EXPO',
      deviceIdHash: 'hashed-device-id',
      appVersion: '1.0.0',
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerId: 'customer-id',
          provider: 'EXPO',
          deviceIdHash: 'hashed-device-id',
        },
      }),
    );
    const calls = update.mock.calls as unknown as Array<[unknown]>;
    const updateInput = calls[0]?.[0] as {
      where: { id: string };
      data: { token: string };
      select?: { token?: boolean };
    };
    expect(updateInput.where).toEqual({ id: 'device-id' });
    expect(updateInput.data.token).toBe('new-token');
    expect(updateInput.select?.token).not.toBe(true);
    expect(result).not.toHaveProperty('token');
  });
});
