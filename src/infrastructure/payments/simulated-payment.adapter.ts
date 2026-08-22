import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CreatePaymentLinkInput, PaymentLinkResult, PaymentProvider, PaymentWebhookResult } from '../../shared/application/ports/payment-provider.interface';

@Injectable()
export class SimulatedPaymentAdapter implements PaymentProvider {
  public readonly name = 'simulated';

  public async createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
    const id = createHash('sha256').update(`${input.orderId}:${input.amount}`).digest('hex').slice(0, 24);
    return { provider: this.name, preferenceId: `SIM-${id}`, paymentUrl: `/mock-payment/${input.orderId}`, expiresAt: input.expiresAt, rawResponse: { simulated: true } };
  }

  public async parseWebhook(input: { headers: Record<string, string | string[] | undefined>; body: unknown }): Promise<PaymentWebhookResult> {
    const body = (input.body ?? {}) as Record<string, unknown>;
    const data = (body.data ?? {}) as Record<string, unknown>;
    return { externalEventId: String(body.id ?? data.id ?? `simulated-${Date.now()}`), eventType: String(body.type ?? 'payment'), externalPaymentId: String(data.id ?? ''), externalReference: typeof body.external_reference === 'string' ? body.external_reference : undefined, status: 'PENDING', rawPayload: input.body };
  }
}
