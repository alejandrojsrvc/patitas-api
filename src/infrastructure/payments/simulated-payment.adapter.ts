import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  CreatePaymentLinkInput,
  PaymentLinkResult,
  PaymentProvider,
  PaymentWebhookResult,
} from '../../shared/application/ports/payment-provider.interface';

@Injectable()
export class SimulatedPaymentAdapter implements PaymentProvider {
  public readonly name = 'simulated';

  public createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<PaymentLinkResult> {
    const id = createHash('sha256')
      .update(`${input.orderId}:${input.amount}`)
      .digest('hex')
      .slice(0, 24);
    return Promise.resolve({
      provider: this.name,
      preferenceId: `SIM-${id}`,
      paymentUrl: `/mock-payment/${input.orderId}`,
      expiresAt: input.expiresAt,
      rawResponse: { simulated: true },
    });
  }

  public parseWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  }): Promise<PaymentWebhookResult> {
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
      status: 'PENDING',
      rawPayload: input.body,
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
