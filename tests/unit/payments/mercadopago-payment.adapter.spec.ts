import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { MercadoPagoPaymentAdapter } from '../../../src/infrastructure/payments/mercadopago-payment.adapter';

describe('MercadoPagoPaymentAdapter', () => {
  const buildConfig = (values: Record<string, string | undefined>) =>
    ({
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    }) as unknown as ConfigService;

  it('creates a Checkout Pro preference through the SDK', async () => {
    const adapter = new MercadoPagoPaymentAdapter(
      buildConfig({
        MERCADOPAGO_ACCESS_TOKEN: 'TEST-access-token',
      }),
    );
    const preference = (
      adapter as unknown as {
        preference: { create: jest.Mock };
      }
    ).preference;
    preference.create = jest.fn().mockResolvedValue({
      id: 'preference-123',
      init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect',
    });

    const result = await adapter.initiatePayment({
      attemptId: 'attempt-123',
      orderId: 'order-123',
      title: 'Pedido Patitas order-123',
      amount: '1500.50',
      currency: 'ARS',
      payerEmail: 'buyer@example.com',
      externalReference: 'order-123',
      idempotencyKey: 'mercadopago:order-123:attempt-1',
      expiresAt: new Date('2026-08-24T12:00:00.000Z'),
    });

    expect(preference.create).toHaveBeenCalledWith({
      body: {
        items: [
          {
            id: 'order-123',
            title: 'Pedido Patitas order-123',
            quantity: 1,
            currency_id: 'ARS',
            unit_price: 1500.5,
          },
        ],
        payer: { email: 'buyer@example.com' },
        external_reference: 'order-123',
        notification_url: undefined,
        expires: true,
        expiration_date_to: '2026-08-24T12:00:00.000Z',
      },
      requestOptions: {
        idempotencyKey: 'mercadopago:order-123:attempt-1',
      },
    });
    expect(result).toMatchObject({
      provider: 'mercadopago',
      externalId: 'preference-123',
      paymentUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect',
      status: 'PENDING',
    });
  });

  it('validates the SDK webhook signature and retrieves the payment through the SDK', async () => {
    const secret = 'webhook-secret';
    const adapter = new MercadoPagoPaymentAdapter(
      buildConfig({
        MERCADOPAGO_ACCESS_TOKEN: 'TEST-access-token',
        MERCADOPAGO_WEBHOOK_SECRET: secret,
      }),
    );
    const payment = (adapter as unknown as { payment: { get: jest.Mock } })
      .payment;
    payment.get = jest.fn().mockResolvedValue({
      status: 'approved',
      external_reference: 'order-123',
    });
    const requestId = 'request-123';
    const dataId = 'payment-123';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
    const signature = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    const receipt = await adapter.parseWebhook({
      headers: {
        'x-request-id': requestId,
        'x-signature': `ts=${timestamp},v1=${signature}`,
      },
      dataId,
      body: {
        type: 'payment',
        data: { id: dataId },
      },
    });

    const result = await adapter.resolveWebhook(receipt);

    expect(payment.get).toHaveBeenCalledWith({ id: dataId });
    expect(result).toMatchObject({
      externalEventId: `payment:${dataId}`,
      externalPaymentId: dataId,
      externalReference: 'order-123',
      status: 'APPROVED',
    });
  });
});
