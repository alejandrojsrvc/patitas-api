import { DomainError } from '../../../shared/domain/domain-error';
import type {
  PaymentRepository,
  PaymentOwner,
} from '../domain/payment.repository';
import type { MarketingService } from '../../marketing/application/marketing.service';

export class PaymentValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'PAYMENT_VALIDATION_FAILED');
  }
}

export class PaymentService {
  public constructor(
    private readonly repository: PaymentRepository,
    private readonly marketing?: MarketingService,
  ) {}
  public createLink(orderId: string, owner: PaymentOwner) {
    if (!orderId) throw new PaymentValidationError('El pedido es obligatorio.');
    return this.repository.createLink(orderId, owner);
  }
  public async webhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  }) {
    const result = await this.repository.handleWebhook(input);
    if (result.orderId && result.status === 'APPROVED' && this.marketing)
      await this.marketing.record({
        eventName: 'Purchase',
        eventId: result.orderId,
        source: 'server',
        orderId: result.orderId,
        value: result.value,
        currency: 'ARS',
      });
    return result;
  }
}
