import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  InitiatePaymentInput,
  PaymentInitiationResult,
  PaymentProvider,
  PaymentWebhookReceipt,
  PaymentWebhookResult,
} from '../../shared/application/ports/payment-provider.interface';

@Injectable()
export class SimulatedPaymentAdapter implements PaymentProvider {
  public readonly name = 'simulated';

  public createExternalReference(input: {
    orderId: string;
    attemptId: string;
  }): string {
    return `simulated:${input.orderId}:${input.attemptId}`;
  }

  public initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<PaymentInitiationResult> {
    const id = createHash('sha256')
      .update(`${input.orderId}:${input.amount}`)
      .digest('hex')
      .slice(0, 24);
    return Promise.resolve({
      provider: this.name,
      externalId: `SIM-${id}`,
      paymentUrl: `/mock-payment/${input.orderId}`,
      status: 'PENDING',
      amount: input.amount,
      currency: input.currency,
      expiresAt: input.expiresAt,
      rawResponse: { simulated: true },
    });
  }

  public parseWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  }): Promise<PaymentWebhookReceipt> {
    const body = asRecord(input.body);
    const data = asRecord(body.data);
    return Promise.resolve({
      externalEventId:
        scalarString(body.id) ??
        scalarString(data.id) ??
        `simulated-${Date.now()}`,
      eventType: scalarString(body.type) ?? 'payment',
      externalPaymentId: scalarString(data.id) ?? '',
      externalReference:
        typeof body.external_reference === 'string'
          ? body.external_reference
          : undefined,
      rawPayload: input.body,
    });
  }

  public resolveWebhook(
    receipt: PaymentWebhookReceipt,
  ): Promise<PaymentWebhookResult> {
    return Promise.resolve({ ...receipt, status: 'PENDING' });
  }

  public refundPayment(): Promise<{
    status: 'REFUNDED';
    externalOperationId: string;
    rawResponse: { simulated: true };
  }> {
    return Promise.resolve({
      status: 'REFUNDED',
      externalOperationId: `SIM-REFUND-${Date.now()}`,
      rawResponse: { simulated: true },
    });
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const scalarString = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined;
