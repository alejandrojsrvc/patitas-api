import { MobilePaymentService } from '../../../src/modules/mobile/application/mobile-payment.service';
import type { MobilePaymentMethodRepository } from '../../../src/modules/mobile/domain/mobile-payment-method.repository';

describe('MobilePaymentService', () => {
  it('combines saved instruments and enabled providers for checkout', async () => {
    const methods = {
      list: jest.fn().mockResolvedValue([
        {
          id: 'saved-id',
          provider: 'payway',
          type: 'CARD',
          brand: 'Visa',
          lastFour: '4242',
          isDefault: true,
        },
      ]),
    } as unknown as MobilePaymentMethodRepository;
    const service = new MobilePaymentService({} as never, methods);

    await expect(service.listMethods('customer-id', [{ provider: 'mercadopago', paymentMethod: 'MERCADO_PAGO' }])).resolves.toMatchObject({
      items: [
        {
          id: 'saved-id',
          type: 'SAVED_CARD',
          provider: 'PAYWAY',
          savedPaymentMethodId: 'saved-id',
        },
        {
          id: 'mercadopago',
          type: 'WALLET',
          provider: 'MERCADO_PAGO',
        },
      ],
    });
  });

  it('exposes the manual bank transfer benefit and instructions', async () => {
    const methods = {
      list: jest.fn().mockResolvedValue([]),
    } as unknown as MobilePaymentMethodRepository;
    const service = new MobilePaymentService({} as never, methods);

    await expect(
      service.listMethods('customer-id', [
        {
          provider: 'manual_transfer',
          paymentMethod: 'BANK_TRANSFER',
          benefit: {
            percentage: '3.00',
            description: 'Descuento por transferencia',
          },
          transfer: {
            expirationMinutes: 120,
            instructions: {
              accountHolder: 'Patitas SRL',
              bank: 'Banco de prueba',
              alias: 'patitas.transferencia',
              cbu: null,
              note: null,
            },
          },
        },
      ]),
    ).resolves.toMatchObject({
      items: [
        {
          id: 'manual_transfer',
          type: 'BANK_TRANSFER',
          provider: 'MANUAL_TRANSFER',
          benefit: { percentage: '3.00' },
          transfer: { expirationMinutes: 120 },
        },
      ],
    });
  });
});
