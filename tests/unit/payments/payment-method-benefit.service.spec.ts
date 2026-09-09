import { PaymentMethodBenefitService } from '../../../src/modules/payments/application/payment-method-benefit.service';
import type { PaymentMethodBenefitRepository } from '../../../src/modules/payments/domain/payment-method-benefit.repository';

describe('PaymentMethodBenefitService', () => {
  it('does not enable transfer without bank instructions', async () => {
    const updateTransfer = jest.fn();
    const repository = {
      transfer: jest.fn().mockResolvedValue({
        id: 'configuration-1',
        paymentMethod: 'BANK_TRANSFER',
        enabled: false,
        discountPercent: '3.00',
        expirationMinutes: 120,
        instructions: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      updateTransfer,
    } as unknown as PaymentMethodBenefitRepository;
    const service = new PaymentMethodBenefitService(repository);

    await expect(service.updateTransfer({ enabled: true })).rejects.toThrow('datos bancarios son obligatorios');
    expect(updateTransfer).not.toHaveBeenCalled();
  });

  it('allows disabling transfer without changing its configured instructions', async () => {
    const configuration = {
      id: 'configuration-1',
      paymentMethod: 'BANK_TRANSFER',
      enabled: true,
      discountPercent: '3.00',
      expirationMinutes: 120,
      instructions: {
        accountHolder: 'Patitas SRL',
        bank: 'Banco de prueba',
        alias: 'patitas.transferencia',
        cbu: null,
        note: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updateTransfer = jest.fn().mockResolvedValue({ ...configuration, enabled: false });
    const repository = {
      transfer: jest.fn().mockResolvedValue(configuration),
      updateTransfer,
    } as unknown as PaymentMethodBenefitRepository;
    const service = new PaymentMethodBenefitService(repository);

    await expect(service.updateTransfer({ enabled: false })).resolves.toMatchObject({
      enabled: false,
    });
    expect(updateTransfer).toHaveBeenCalledWith({ enabled: false });
  });
});
