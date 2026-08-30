import { ReplenishmentService } from '../../../src/modules/replenishment/application/replenishment.service';
import type { ReplenishmentRepository } from '../../../src/modules/replenishment/domain/replenishment.repository';
import type { ReplenishmentPlan } from '../../../src/modules/replenishment/domain/replenishment.types';

const plan = {
  id: 'plan-1',
  status: 'ACTIVE',
} as ReplenishmentPlan;

describe('ReplenishmentService Mobile state', () => {
  it('delegates consumption state changes without coupling to orders', async () => {
    const updateMobileState = jest.fn().mockResolvedValue(plan);
    const repository = {
      updateMobileState,
    } as unknown as ReplenishmentRepository;
    const service = new ReplenishmentService(repository);

    await service.updateMobileState(
      'plan-1',
      { customerId: 'customer-1' },
      {
        remindersEnabled: false,
        leadDays: 7,
      },
    );

    expect(updateMobileState).toHaveBeenCalledWith(
      'plan-1',
      { customerId: 'customer-1' },
      { remindersEnabled: false, leadDays: 7 },
    );
  });

  it('rejects invalid lead days before reaching persistence', () => {
    const updateMobileState = jest.fn();
    const repository = {
      updateMobileState,
    } as unknown as ReplenishmentRepository;
    const service = new ReplenishmentService(repository);

    expect(() =>
      service.updateMobileState(
        'plan-1',
        { customerId: 'customer-1' },
        {
          leadDays: 31,
        },
      ),
    ).toThrow('entre 0 y 30');
    expect(updateMobileState).not.toHaveBeenCalled();
  });
});
