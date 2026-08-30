import { MobileAccessService } from '../../../src/modules/mobile/application/mobile-access.service';
import type { MobileAccessRepository } from '../../../src/shared/application/ports/mobile-access.repository';

describe('MobileAccessService', () => {
  it('normalizes optional metadata before persistence', async () => {
    const repository: jest.Mocked<MobileAccessRepository> = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MobileAccessService(repository);

    await service.record({
      userId: 'user-id',
      role: 'CUSTOMER',
      deviceId: '  device-id  ',
      platform: '  ios  ',
      appVersion: ' 1.2.3 ',
    });

    expect(repository.record.mock.calls[0][0]).toEqual({
      userId: 'user-id',
      role: 'CUSTOMER',
      deviceId: 'device-id',
      platform: 'ios',
      appVersion: '1.2.3',
    });
  });
});
