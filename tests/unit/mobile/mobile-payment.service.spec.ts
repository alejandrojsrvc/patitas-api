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

    await expect(
      service.listMethods('customer-id', [
        { provider: 'mercadopago', paymentMethod: 'MERCADO_PAGO' },
      ]),
    ).resolves.toMatchObject({
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
});
