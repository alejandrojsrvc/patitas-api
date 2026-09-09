import { DomainError } from '../../../shared/domain/domain-error';
import type { PaymentRepository, PaymentOwner } from '../domain/payment.repository';
import type { MarketingService } from '../../marketing/application/marketing.service';
import type { PaymentProviderName, TokenizedCardPayment } from '../../../shared/domain/payment.types';
import type { PaymentWebhookReceipt } from '../../../shared/domain/payment.types';
import type { PaymentProviderResolver } from '../../../shared/application/ports/payment-provider.interface';
import type { PaymentProviderConfigurationRepository } from '../domain/payment-provider-configuration.repository';
import type { PaymentMethodBenefitService } from './payment-method-benefit.service';
import type { StorageProvider } from '../../../shared/application/ports/storage-provider.interface';
import { detectFileContentType } from '../../../shared/application/file-signature';

export class PaymentValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'PAYMENT_VALIDATION_FAILED');
  }
}

export class PaymentConflictError extends DomainError {
  public constructor(message: string) {
    super(message, 'PAYMENT_IDEMPOTENCY_CONFLICT');
  }
}

export class PaymentService {
  public constructor(
    private readonly repository: PaymentRepository,
    private readonly marketing?: MarketingService,
    private readonly providers?: PaymentProviderResolver,
    private readonly configurations?: PaymentProviderConfigurationRepository,
    private readonly benefits?: PaymentMethodBenefitService,
    private readonly storage?: StorageProvider,
  ) {}

  public async assertMethodAvailable(paymentMethod: string | null): Promise<void> {
    if (paymentMethod === 'MERCADO_PAGO') {
      if (!this.providers) throw new PaymentValidationError('Proveedor no disponible.');
      await this.assertProvider('mercadopago');
      return;
    }
    if (paymentMethod === 'PAYWAY') {
      if (!this.providers) throw new PaymentValidationError('Proveedor no disponible.');
      await this.assertProvider('payway');
      return;
    }
    if (paymentMethod === 'BANK_TRANSFER') {
      if (!this.benefits) throw new PaymentValidationError('Proveedor no disponible.');
      await this.benefits.assertTransferAvailable();
      return;
    }
    throw new PaymentValidationError('El método de pago no es válido.');
  }

  private async assertProvider(provider: PaymentProviderName): Promise<void> {
    if (this.configurations && !(await this.configurations.isEnabled(provider)))
      throw new PaymentValidationError(`La pasarela ${provider} está deshabilitada en la configuración de pagos.`);
    try {
      const resolved = this.providers?.resolve(provider);
      resolved?.assertReady?.();
    } catch {
      throw new PaymentValidationError(`La pasarela ${provider} no está disponible. Verifica sus credenciales y la configuración del proveedor.`);
    }
  }
  public initiate(orderId: string, owner: PaymentOwner, paymentMethod?: TokenizedCardPayment, idempotencyKey?: string) {
    if (!orderId) throw new PaymentValidationError('El pedido es obligatorio.');
    if (!idempotencyKey?.trim()) throw new PaymentValidationError('Idempotency-Key es obligatorio para iniciar un pago.');
    return this.repository.initiate(orderId, owner, paymentMethod, idempotencyKey).then(async (result) => {
      if (result.status === 'APPROVED' && this.marketing)
        await this.marketing.record({
          eventName: 'Purchase',
          eventId: result.orderId,
          source: 'server',
          orderId: result.orderId,
          currency: 'ARS',
        });
      return result;
    });
  }
  public refund(orderId: string, owner: PaymentOwner, amount: string | undefined, idempotencyKey?: string) {
    if (!idempotencyKey?.trim()) throw new PaymentValidationError('Idempotency-Key es obligatorio para solicitar un refund.');
    return this.repository.refund(orderId, owner, amount, idempotencyKey.trim());
  }
  public status(orderId: string, owner: PaymentOwner) {
    return this.repository.status(orderId, owner);
  }
  public async transferStatus(orderId: string, owner: PaymentOwner) {
    return this.resolveTransferProof(await this.repository.transferStatus(orderId, owner));
  }
  public async reportTransfer(orderId: string, owner: PaymentOwner, reference?: string | null) {
    return this.resolveTransferProof(await this.repository.reportTransfer(orderId, owner, reference?.trim() || null));
  }
  public async uploadTransferProof(orderId: string, owner: PaymentOwner, input: { originalName: string; contentType: string; data: Uint8Array }) {
    if (!this.storage) throw new PaymentValidationError('El almacenamiento de comprobantes no está disponible.');
    const contentType = detectFileContentType(input.data);
    if (!contentType || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(contentType))
      throw new PaymentValidationError('El comprobante debe ser PDF, JPEG, PNG o WebP.');
    if (!input.data.byteLength || input.data.byteLength > 10 * 1024 * 1024)
      throw new PaymentValidationError('El comprobante debe pesar entre 1 byte y 10 MB.');
    const stored = await this.storage.upload({
      object: {
        bucket: 'payment-proofs',
        path: `orders/${orderId}/transfer/${Date.now()}-${safeFileName(input.originalName)}`,
      },
      data: input.data,
      contentType,
    });
    try {
      return await this.resolveTransferProof(await this.repository.uploadTransferProof(orderId, owner, stored.path));
    } catch (error) {
      await this.storage.delete(stored).catch(() => undefined);
      throw error;
    }
  }
  public async listPendingTransfers() {
    const transfers = await this.repository.listPendingTransfers();
    return Promise.all(transfers.map((transfer) => this.resolveTransferProof(transfer)));
  }
  public async confirmTransfer(
    attemptId: string,
    input: {
      amount: string;
      reference?: string | null;
      note?: string | null;
      actorUserId: string;
    },
  ) {
    if (!/^\d+(\.\d{1,2})?$/.test(input.amount) || Number(input.amount) <= 0) throw new PaymentValidationError('El importe confirmado no es válido.');
    const result = await this.repository.confirmTransfer(attemptId, {
      ...input,
      reference: input.reference?.trim() || null,
      note: input.note?.trim() || null,
    });
    if (result.status === 'APPROVED' && this.marketing)
      await this.marketing.record({
        eventName: 'Purchase',
        eventId: result.orderId,
        source: 'server',
        orderId: result.orderId,
        value: result.expectedAmount,
        currency: result.currency,
      });
    return this.resolveTransferProof(result);
  }

  private async resolveTransferProof<T extends { proofUrl: string | null }>(transfer: T): Promise<T> {
    if (!this.storage || !transfer.proofUrl || /^https?:\/\//i.test(transfer.proofUrl)) return transfer;
    return {
      ...transfer,
      proofUrl: await this.storage.getSignedUrl({ bucket: 'payment-proofs', path: transfer.proofUrl }, 900),
    };
  }
  public async webhook(input: { provider: PaymentProviderName; receipt: PaymentWebhookReceipt }) {
    const result = await this.repository.handleWebhook(input);
    if (result.orderId && result.status === 'APPROVED' && !result.reconciliationRequired && this.marketing)
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

const safeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'proof';
