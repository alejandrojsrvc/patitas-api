import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { PaywayPaymentAdapter } from '../../../src/infrastructure/payments/payway-payment.adapter';

describe('PaywayPaymentAdapter', () => {
  const buildConfig = (values: Record<string, string | undefined>) =>
    ({
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    }) as unknown as ConfigService;

  afterEach(() => jest.restoreAllMocks());

  it('creates a payment with a one-time card token', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          status: 'approved',
          token: 'must-not-leak',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const adapter = new PaywayPaymentAdapter(
      buildConfig({
        PAYWAY_PRIVATE_API_KEY: 'private-key',
        PAYWAY_API_BASE_URL: 'https://payway.example/api/v2',
        PAYWAY_WEBHOOK_SECRET: 'webhook-secret',
      }),
    );

    const result = await adapter.initiatePayment({
      attemptId: 'attempt-123',
      orderId: 'order-123',
      title: 'Pedido Patitas order-123',
      amount: '1500.50',
      currency: 'ARS',
      payerEmail: 'buyer@example.com',
      externalReference: 'order-123',
      idempotencyKey: 'payway:order-123:attempt-1',
      paymentMethod: {
        type: 'TOKENIZED_CARD',
        token: 'one-time-token',
        paymentMethodReference: 1,
        cardBin: '450799',
        installments: 1,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const paymentRequest = fetchMock.mock.calls[0];
    expect(paymentRequest?.[0]).toBe('https://payway.example/api/v2/payments');
    expect(paymentRequest?.[1]?.method).toBe('POST');
    const paymentHeaders = new Headers(paymentRequest?.[1]?.headers);
    expect(paymentHeaders.get('apikey')).toBe('private-key');
    expect(paymentHeaders.get('X-Idempotency-Key')).toBe(
      'payway:order-123:attempt-1',
    );
    expect(paymentRequest?.[1]?.body).toContain('"amount":150050');
    expect(result).toMatchObject({
      provider: 'payway',
      externalId: '12345',
      status: 'APPROVED',
      rawResponse: { id: 12345, status: 'approved' },
    });
  });

  it('retrieves the authoritative payment state for a webhook', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          status: 'approved',
          site_transaction_id: 'order-123',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const adapter = new PaywayPaymentAdapter(
      buildConfig({
        PAYWAY_PRIVATE_API_KEY: 'private-key',
        PAYWAY_API_BASE_URL: 'https://payway.example/api/v2',
        PAYWAY_WEBHOOK_SECRET: 'webhook-secret',
      }),
    );

    const receipt = await adapter.parseWebhook({
      headers: {
        'x-payway-signature': createHmac('sha256', 'webhook-secret')
          .update(JSON.stringify({ data: { id: 12345 } }))
          .digest('hex'),
      },
      body: { data: { id: 12345 } },
    });

    const result = await adapter.resolveWebhook(receipt);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const webhookRequest = fetchMock.mock.calls[0];
    expect(webhookRequest?.[0]).toBe(
      'https://payway.example/api/v2/payments/12345',
    );
    const webhookHeaders = new Headers(webhookRequest?.[1]?.headers);
    expect(webhookHeaders.get('apikey')).toBe('private-key');
    expect(result).toMatchObject({
      externalEventId: 'payment:12345',
      externalPaymentId: '12345',
      externalReference: 'order-123',
      status: 'APPROVED',
    });
  });
});
