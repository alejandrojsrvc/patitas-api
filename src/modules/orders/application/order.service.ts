import type { CustomerService } from '../../customers/application/customer.service';
import { OrderNotFoundError, OrderValidationError } from '../domain/order.error';
import type { OrderRepository } from '../domain/order.repository';
import type {
  CreateOrderInput,
  OrderFilter,
  OrderStatus,
  RegisterPaymentInput,
  UpdateOrderInput,
} from '../domain/order.types';

export class OrderService {
  public constructor(
    private readonly repository: OrderRepository,
    private readonly customers: CustomerService,
  ) {}

  public list(filter: OrderFilter) { return this.repository.list(filter); }

  public async find(id: string) {
    const order = await this.repository.findById(id);
    if (!order) throw new OrderNotFoundError();
    return order;
  }

  public async create(input: CreateOrderInput) {
    validateOrder(input);
    const customerId = input.customerId
      ? await this.resolveActiveCustomer(input.customerId)
      : (await this.customers.create({
          fullName: input.contactName,
          email: input.contactEmail,
          phone: input.contactPhone,
        })).id;
    return this.repository.create(normalizeOrder({ ...input, customerId }));
  }

  public async update(id: string, input: UpdateOrderInput) {
    await this.find(id);
    validateOrder(input);
    return this.repository.update(id, normalizeOrder(input));
  }

  public async registerPayment(id: string, input: RegisterPaymentInput) {
    await this.find(id);
    if (!input.method.trim()) throw new OrderValidationError('El método de pago es obligatorio.');
    if (!/^\d+(\.\d{1,2})?$/.test(input.amount) || Number(input.amount) <= 0) {
      throw new OrderValidationError('El monto del pago no es válido.');
    }
    return this.repository.registerPayment(id, {
      ...input,
      method: input.method.trim(),
      reference: input.reference?.trim() || null,
      proofUrl: input.proofUrl?.trim() || null,
    });
  }

  public async transition(id: string, status: OrderStatus) {
    await this.find(id);
    return this.repository.transition(id, status);
  }

  private async resolveActiveCustomer(id: string): Promise<string> {
    const customer = await this.customers.find(id);
    if (!customer.active) throw new OrderValidationError('El cliente seleccionado está inactivo.');
    return customer.id;
  }
}

const validateOrder = (input: Partial<CreateOrderInput> & UpdateOrderInput): void => {
  if (input.contactName !== undefined && !input.contactName.trim()) {
    throw new OrderValidationError('El nombre de contacto es obligatorio.');
  }
  if (input.contactEmail !== undefined && !/^\S+@\S+\.\S+$/.test(input.contactEmail.trim())) {
    throw new OrderValidationError('El email de contacto no es válido.');
  }
  if (input.lines && (!input.lines.length || input.lines.some((line) => line.quantity < 1))) {
    throw new OrderValidationError('El pedido debe tener líneas con cantidades válidas.');
  }
  if (input.lines && new Set(input.lines.map((line) => line.variantId)).size !== input.lines.length) {
    throw new OrderValidationError('Una variante no puede repetirse en el mismo pedido.');
  }
  if (input.shippingCost !== undefined && (!/^\d+(\.\d{1,2})?$/.test(input.shippingCost) || Number(input.shippingCost) < 0)) {
    throw new OrderValidationError('El costo de envío no es válido.');
  }
};

const normalizeOrder = <T extends Partial<CreateOrderInput> & UpdateOrderInput>(input: T): T => ({
  ...input,
  ...(input.contactName !== undefined ? { contactName: input.contactName.trim() } : {}),
  ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail.trim().toLowerCase() } : {}),
  ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone?.trim() || null } : {}),
});
