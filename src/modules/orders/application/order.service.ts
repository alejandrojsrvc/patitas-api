import type { CustomerService } from '../../customers/application/customer.service';
import type { StorageProvider } from '../../../shared/application/ports/storage-provider.interface';
import { randomUUID } from 'node:crypto';
import {
  OrderNotFoundError,
  OrderValidationError,
} from '../domain/order.error';
import type { OrderRepository } from '../domain/order.repository';
import type {
  CreateOrderInput,
  Order,
  OrderFilter,
  OrderStatus,
  RegisterPaymentInput,
  UpdateOrderInput,
} from '../domain/order.types';

export class OrderService {
  public constructor(
    private readonly repository: OrderRepository,
    private readonly customers: CustomerService,
    private readonly storage: StorageProvider,
  ) {}

  public async list(filter: OrderFilter) {
    const page = await this.repository.list(filter);
    return {
      ...page,
      items: await Promise.all(
        page.items.map((order) => this.resolveProofUrls(order)),
      ),
    };
  }

  public async find(id: string) {
    const order = await this.repository.findById(id);
    if (!order) throw new OrderNotFoundError();
    return this.resolveProofUrls(order);
  }

  public async create(input: CreateOrderInput) {
    validateOrder(input);
    const customerId = input.customerId
      ? await this.resolveActiveCustomer(input.customerId)
      : undefined;
    return this.resolveProofUrls(
      await this.repository.create(normalizeOrder({ ...input, customerId })),
    );
  }

  public async update(id: string, input: UpdateOrderInput) {
    await this.find(id);
    validateOrder(input);
    return this.resolveProofUrls(
      await this.repository.update(id, normalizeOrder(input)),
    );
  }

  public async registerPayment(id: string, input: RegisterPaymentInput) {
    await this.find(id);
    if (!input.method.trim())
      throw new OrderValidationError('El método de pago es obligatorio.');
    if (!/^\d+(\.\d{1,2})?$/.test(input.amount) || Number(input.amount) <= 0) {
      throw new OrderValidationError('El monto del pago no es válido.');
    }
    return this.resolveProofUrls(
      await this.repository.registerPayment(id, {
        ...input,
        method: input.method.trim(),
        reference: input.reference?.trim() || null,
        proofUrl: input.proofUrl?.trim() || null,
      }),
    );
  }

  public async transition(id: string, status: OrderStatus) {
    await this.find(id);
    return this.resolveProofUrls(await this.repository.transition(id, status));
  }

  public async uploadPaymentProof(
    orderId: string,
    input: {
      paymentId: string;
      originalName: string;
      contentType: string;
      data: Uint8Array;
    },
  ) {
    const contentType = input.contentType.toLowerCase();
    if (!PAYMENT_PROOF_TYPES.has(contentType))
      throw new OrderValidationError(
        'El comprobante debe ser PDF, JPEG, PNG o WebP.',
      );
    if (
      !input.data.byteLength ||
      input.data.byteLength > MAX_PAYMENT_PROOF_BYTES
    )
      throw new OrderValidationError(
        'El comprobante debe pesar entre 1 byte y 10 MB.',
      );
    const stored = await this.storage.upload({
      object: {
        bucket: PAYMENT_PROOF_BUCKET,
        path: `orders/${orderId}/payments/${input.paymentId}/${randomUUID()}-${safeFileName(input.originalName)}`,
      },
      data: input.data,
      contentType,
    });
    try {
      return this.resolveProofUrls(
        await this.repository.uploadPaymentProof(orderId, {
          ...input,
          storagePath: stored.path,
          contentType,
          data: input.data,
        }),
      );
    } catch (error) {
      await this.storage.delete(stored).catch(() => undefined);
      throw error;
    }
  }

  private async resolveActiveCustomer(id: string): Promise<string> {
    const customer = await this.customers.find(id);
    if (!customer.active)
      throw new OrderValidationError('El cliente seleccionado está inactivo.');
    return customer.id;
  }

  private async resolveProofUrls(order: Order): Promise<Order> {
    return {
      ...order,
      payments: await Promise.all(
        order.payments.map(async (payment) => ({
          ...payment,
          proofUrl:
            payment.proofUrl && !isHttpUrl(payment.proofUrl)
              ? await this.storage.getSignedUrl(
                  { bucket: PAYMENT_PROOF_BUCKET, path: payment.proofUrl },
                  3_600,
                )
              : payment.proofUrl,
        })),
      ),
    };
  }
}

const PAYMENT_PROOF_BUCKET = 'payment-proofs';
const MAX_PAYMENT_PROOF_BYTES = 10 * 1024 * 1024;
const PAYMENT_PROOF_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const safeFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'proof';

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const validateOrder = (
  input: Partial<CreateOrderInput> & UpdateOrderInput,
): void => {
  if (input.contactName !== undefined && !input.contactName.trim()) {
    throw new OrderValidationError('El nombre de contacto es obligatorio.');
  }
  if (
    input.contactEmail !== undefined &&
    !/^\S+@\S+\.\S+$/.test(input.contactEmail.trim())
  ) {
    throw new OrderValidationError('El email de contacto no es válido.');
  }
  if (
    input.lines &&
    (!input.lines.length || input.lines.some((line) => line.quantity < 1))
  ) {
    throw new OrderValidationError(
      'El pedido debe tener líneas con cantidades válidas.',
    );
  }
  if (
    input.lines &&
    new Set(input.lines.map((line) => line.variantId)).size !==
      input.lines.length
  ) {
    throw new OrderValidationError(
      'Una variante no puede repetirse en el mismo pedido.',
    );
  }
  if (
    input.shippingCost !== undefined &&
    (!/^\d+(\.\d{1,2})?$/.test(input.shippingCost) ||
      Number(input.shippingCost) < 0)
  ) {
    throw new OrderValidationError('El costo de envío no es válido.');
  }
};

const normalizeOrder = <T extends Partial<CreateOrderInput> & UpdateOrderInput>(
  input: T,
): T => ({
  ...input,
  ...(input.contactName !== undefined
    ? { contactName: input.contactName.trim() }
    : {}),
  ...(input.contactEmail !== undefined
    ? { contactEmail: input.contactEmail.trim().toLowerCase() }
    : {}),
  ...(input.contactPhone !== undefined
    ? { contactPhone: input.contactPhone?.trim() || null }
    : {}),
});
