import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { OrderConflictError, OrderNotFoundError, OrderValidationError } from '../domain/order.error';
import type { OrderRepository } from '../domain/order.repository';
import type {
  CreateOrderInput,
  Order,
  OrderFilter,
  OrderPage,
  RegisterPaymentInput,
  UpdateOrderInput,
  UploadPaymentProofInput,
} from '../domain/order.types';
import { releaseOrderReservation, releaseFirstShippingClaim, reverseCouponRedemptions } from './prisma-order-inventory';
import type { OrderInventoryTransaction } from './prisma-order-inventory';

const orderInclude = {
  lines: { orderBy: { id: 'asc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  benefits: { orderBy: { createdAt: 'asc' as const } },
  statusEvents: { orderBy: { occurredAt: 'asc' as const } },
} as const;

type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(filter: OrderFilter): Promise<OrderPage> {
    const search = filter.q?.trim();
    const searchConditions: Prisma.OrderWhereInput[] = search
      ? [
          { contactName: { contains: search, mode: 'insensitive' } },
          { contactEmail: { contains: search, mode: 'insensitive' } },
          ...(isUuid(search) ? [{ id: search }] : []),
        ]
      : [];
    const where: Prisma.OrderWhereInput = {
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.paymentStatus ? { paymentStatus: filter.paymentStatus } : {}),
      ...(searchConditions.length ? { OR: searchConditions } : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: records.map(mapOrder),
      page: filter.page,
      perPage: filter.perPage,
      total,
    };
  }

  public async findById(id: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    return order ? mapOrder(order) : null;
  }

  public async create(input: CreateOrderInput): Promise<Order> {
    return this.prisma.$transaction(async (transaction) => {
      const variantIds = input.lines.map((line) => line.variantId);
      const variants = await transaction.productVariant.findMany({
        where: {
          id: { in: variantIds },
          active: true,
          product: { status: 'ACTIVE' },
        },
        include: { product: true },
      });
      if (variants.length !== new Set(variantIds).size) throw new OrderValidationError('Una variante no existe o no está activa.');
      const byId = new Map(variants.map((variant) => [variant.id, variant]));
      const lines = input.lines.map((line) => {
        const variant = byId.get(line.variantId);
        if (!variant?.salePrice) throw new OrderValidationError('Todas las variantes deben tener precio.');
        const unitPrice = Number(variant.salePrice);
        return {
          variantId: line.variantId,
          productName: variant.product.name,
          sku: variant.sku,
          presentation: variant.presentation,
          unitPrice: unitPrice.toFixed(2),
          quantity: line.quantity,
          lineTotal: (unitPrice * line.quantity).toFixed(2),
        };
      });
      const subtotal = lines.reduce((sum, line) => sum + Number(line.lineTotal), 0);
      const shippingCost = Number(input.shippingCost ?? '0');
      const created = await transaction.order.create({
        data: {
          id: randomUUID(),
          customerId: input.customerId ?? null,
          source: input.source ?? 'STORE',
          status: 'DRAFT',
          paymentStatus: 'UNPAID',
          subtotal: subtotal.toFixed(2),
          shippingCost: shippingCost.toFixed(2),
          total: (subtotal + shippingCost).toFixed(2),
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone ?? null,
          shippingAddress: input.shippingAddress,
          notes: input.notes ?? null,
          deliveryInstructions: input.deliveryInstructions ?? null,
          lines: {
            create: lines.map((line) => ({ id: randomUUID(), ...line })),
          },
        },
        include: { lines: true },
      });
      await transaction.order.update({ where: { id: created.id }, data: { number: created.orderNumber.toString() } });
      await reserve(transaction, created.lines, created.id);
      await recordStatusEvent(transaction, created.id, 'DRAFT');
      return mapOrder(
        await transaction.order.findUniqueOrThrow({
          where: { id: created.id },
          include: orderInclude,
        }),
      );
    });
  }

  public async update(id: string, input: UpdateOrderInput): Promise<Order> {
    try {
      return mapOrder(
        await this.prisma.order.update({
          where: { id },
          data: input,
          include: orderInclude,
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new OrderNotFoundError();
      throw error;
    }
  }

  public async registerPayment(id: string, input: RegisterPaymentInput): Promise<Order> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`);
      const order = await transaction.order.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!order) throw new OrderNotFoundError();
      if (order.paymentMethod === 'BANK_TRANSFER')
        throw new OrderConflictError('Las transferencias se confirman desde la revisión de pagos por transferencia.');
      if (!['DRAFT', 'PENDING_PAYMENT'].includes(order.status))
        throw new OrderConflictError('No se puede registrar un pago en el estado actual del pedido.');
      const paid =
        order.payments.filter((payment) => payment.kind === 'PAYMENT' && payment.paidAt).reduce((sum, payment) => sum + Number(payment.amount), 0) +
        (input.paidAt ? Number(input.amount) : 0);
      if (order.paymentStatus === 'PAID' || paid > Number(order.total))
        throw new OrderConflictError('El importe supera el saldo pendiente del pedido.');
      await transaction.orderPayment.create({
        data: {
          id: randomUUID(),
          orderId: id,
          amount: input.amount,
          currency: order.currency,
          kind: 'PAYMENT',
          method: input.method,
          reference: input.reference ?? null,
          proofUrl: input.proofUrl ?? null,
          paidAt: input.paidAt ?? null,
        },
      });
      await transaction.order.update({
        where: { id },
        data: {
          paymentStatus: paid >= Number(order.total) ? 'PAID' : 'PENDING',
          paymentMethod: input.method,
          paymentReference: input.reference ?? null,
        },
      });
      if (paid >= Number(order.total)) {
        await transaction.shipment.upsert({
          where: { orderId: id },
          create: {
            id: randomUUID(),
            orderId: id,
            status: 'PENDING',
            events: { create: { id: randomUUID(), status: 'PENDING', visibleMessage: 'Recibimos tu pedido.' } },
          },
          update: {},
        });
        await transaction.notificationDelivery.upsert({
          where: { idempotencyKey: `order-confirmation:${id}:PAID` },
          create: {
            id: randomUUID(),
            channel: 'EMAIL',
            template: 'order_confirmation',
            destinationHash: createHash('sha256').update(order.contactEmail.trim().toLowerCase()).digest('hex'),
            idempotencyKey: `order-confirmation:${id}:PAID`,
            orderId: id,
            customerId: order.customerId,
          },
          update: {},
        });
      }
      const updated = await transaction.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
      return mapOrder(updated);
    });
  }

  public async transition(id: string, status: Order['status']): Promise<Order> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id },
        include: { lines: true, payments: true },
      });
      if (!order) throw new OrderNotFoundError();
      if (order.status === status && status === 'CANCELLED')
        return mapOrder(
          await transaction.order.findUniqueOrThrow({
            where: { id },
            include: orderInclude,
          }),
        );
      if (!allowedTransitions[order.status].includes(status)) throw new OrderConflictError(`No se puede pasar de ${order.status} a ${status}.`);
      if (status === 'PAID' && order.paymentStatus !== 'PAID')
        throw new OrderConflictError('El pedido debe tener un pago completo antes de marcarse como PAID.');
      const captured = order.payments
        .filter((payment) => payment.kind === 'PAYMENT' && payment.paidAt)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const refunded = order.payments
        .filter((payment) => payment.kind === 'REFUND' && payment.paidAt)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const chargedBack = order.payments
        .filter((payment) => payment.kind === 'CHARGEBACK' && payment.paidAt)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      if (status === 'CANCELLED' && captured - refunded - chargedBack > 0)
        throw new OrderConflictError('El pedido tiene dinero capturado. Requiere un refund explícito antes de cancelarse.');
      if (status === 'PAID') await ensureReservation(transaction, order.lines, id);
      if (status === 'SHIPPED') await ship(transaction, order.lines, id);
      if (status === 'CANCELLED') {
        await releaseOrderReservation(transaction, order.lines, id);
        await releaseFirstShippingClaim(transaction, id);
        if (order.paymentStatus !== 'PAID') await reverseCouponRedemptions(transaction, id);
      }
      await transaction.order.update({ where: { id }, data: { status } });
      await recordStatusEvent(transaction, id, status);
      return mapOrder(
        await transaction.order.findUniqueOrThrow({
          where: { id },
          include: orderInclude,
        }),
      );
    });
  }

  public async expirePaymentReservations(): Promise<{ expired: number }> {
    const candidates = await this.prisma.order.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        reservationReleasedAt: null,
        reservationExpiresAt: { lte: new Date() },
        paymentStatus: {
          notIn: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK'],
        },
      },
      select: { id: true },
    });
    let expired = 0;
    for (const candidate of candidates) {
      const changed = await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT id FROM orders WHERE id = ${candidate.id} FOR UPDATE`);
        const order = await transaction.order.findFirst({
          where: {
            id: candidate.id,
            status: 'PENDING_PAYMENT',
            reservationReleasedAt: null,
            reservationExpiresAt: { lte: new Date() },
            paymentStatus: {
              notIn: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK'],
            },
          },
          include: { lines: true },
        });
        if (!order) return false;
        await releaseOrderReservation(transaction, order.lines, order.id, 'Expiración de reserva');
        await reverseCouponRedemptions(transaction, order.id);
        await releaseFirstShippingClaim(transaction, order.id);
        await transaction.paymentAttempt.updateMany({
          where: {
            orderId: order.id,
            status: { in: ['CREATED', 'PROCESSING', 'PENDING', 'REPORTED'] },
          },
          data: {
            status: 'EXPIRED',
            processingLeaseToken: null,
            processingLeaseUntil: null,
          },
        });
        await transaction.purchaseSchedule.updateMany({
          where: { initialOrderId: order.id, status: 'PENDING_PAYMENT' },
          data: { status: 'CANCELLED' },
        });
        await transaction.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED',
            reservationReleasedAt: new Date(),
          },
        });
        await recordStatusEvent(transaction, order.id, 'CANCELLED');
        return true;
      });
      if (changed) expired += 1;
    }
    return { expired };
  }

  public async uploadPaymentProof(id: string, input: UploadPaymentProofInput): Promise<Order> {
    return this.prisma.$transaction(async (transaction) => {
      const payment = await transaction.orderPayment.findUnique({
        where: { id: input.paymentId },
        select: { orderId: true },
      });
      if (!payment || payment.orderId !== id) throw new OrderConflictError('El pago no pertenece al pedido.');
      await transaction.orderPayment.update({
        where: { id: input.paymentId },
        data: { proofUrl: input.storagePath },
      });
      return mapOrder(
        await transaction.order.findUniqueOrThrow({
          where: { id },
          include: orderInclude,
        }),
      );
    });
  }
}

const isUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const allowedTransitions: Record<Order['status'], Order['status'][]> = {
  DRAFT: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const recordStatusEvent = async (transaction: Prisma.TransactionClient, orderId: string, status: Order['status']): Promise<void> => {
  const events = transaction.orderStatusEvent;
  if (!events) return;
  const existing = await events.findFirst({
    where: { orderId, status },
    select: { id: true },
  });
  if (existing) return;
  await events.create({
    data: { id: randomUUID(), orderId, status },
  });
};

const reserve = async (transaction: OrderInventoryTransaction, lines: Array<{ variantId: string; quantity: number }>, orderId: string) => {
  for (const line of lines) {
    const inventory = await transaction.inventoryItem.findUnique({
      where: { variantId: line.variantId },
    });
    if (!inventory || inventory.onHand - inventory.reserved < line.quantity)
      throw new OrderConflictError('No hay stock suficiente para reservar el pedido.');
    await transaction.inventoryItem.update({
      where: { variantId: line.variantId },
      data: { reserved: { increment: line.quantity } },
    });
    await transaction.inventoryMovement.create({
      data: {
        id: randomUUID(),
        variantId: line.variantId,
        orderId,
        type: 'RESERVE',
        quantity: line.quantity,
        reason: 'Reserva de pedido',
      },
    });
  }
};

const ensureReservation = async (transaction: OrderInventoryTransaction, lines: Array<{ variantId: string; quantity: number }>, orderId: string) => {
  for (const line of lines) {
    const existing = await transaction.inventoryMovement.findFirst({
      where: { orderId, variantId: line.variantId, type: 'RESERVE' },
    });
    if (!existing) await reserve(transaction, [line], orderId);
  }
};

const ship = async (transaction: OrderInventoryTransaction, lines: Array<{ variantId: string; quantity: number }>, orderId: string) => {
  for (const line of lines) {
    const inventory = await transaction.inventoryItem.findUnique({
      where: { variantId: line.variantId },
    });
    if (!inventory || inventory.reserved < line.quantity || inventory.onHand < line.quantity)
      throw new OrderConflictError('El inventario reservado no permite despachar el pedido.');
    await transaction.inventoryItem.update({
      where: { variantId: line.variantId },
      data: {
        onHand: { decrement: line.quantity },
        reserved: { decrement: line.quantity },
      },
    });
    await transaction.inventoryMovement.create({
      data: {
        id: randomUUID(),
        variantId: line.variantId,
        orderId,
        type: 'SHIP',
        quantity: line.quantity,
        reason: 'Despacho de pedido',
      },
    });
  }
};

const mapOrder = (value: OrderRecord): Order => ({
  id: value.id,
  customerId: value.customerId,
  number: value.orderNumber.toString(),
  source: value.source,
  status: value.status,
  paymentStatus: value.paymentStatus,
  canRetry:
    value.status === 'PENDING_PAYMENT' &&
    value.paymentStatus === 'FAILED' &&
    !value.reconciliationRequired &&
    (!value.reservationExpiresAt || value.reservationExpiresAt > new Date()),
  reconciliationRequired: value.reconciliationRequired,
  reconciliationReason: value.reconciliationReason,
  reservationExpiresAt: value.reservationExpiresAt,
  paymentMethod: value.paymentMethod,
  paymentReference: value.paymentReference,
  currency: 'ARS',
  subtotal: value.subtotal.toString(),
  shippingCost: value.shippingCost.toString(),
  shippingProviderCost: value.shippingProviderCost.toString(),
  shippingSubsidy: value.shippingSubsidy.toString(),
  shippingDeliveryCount: value.shippingDeliveryCount,
  shippingVat: value.shippingVat.toString(),
  shippingDeliverySlot: value.shippingDeliverySlot,
  shippingDeliveryDate: value.shippingDeliveryDate,
  total: value.total.toString(),
  contactName: value.contactName,
  contactEmail: value.contactEmail,
  contactPhone: value.contactPhone,
  shippingAddress: toStringRecord(value.shippingAddress),
  deliveryInstructions: value.deliveryInstructions,
  notes: value.notes,
  trackingNumber: value.trackingNumber,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
  availableTransitions: allowedTransitions[value.status] ?? [],
  statusEvents: value.statusEvents.map((event) => ({
    id: event.id,
    status: event.status,
    occurredAt: event.occurredAt,
  })),
  lines: value.lines.map((line) => ({
    id: line.id,
    variantId: line.variantId,
    productName: line.productName,
    sku: line.sku,
    presentation: line.presentation,
    unitPrice: line.unitPrice.toString(),
    quantity: line.quantity,
    lineTotal: line.lineTotal.toString(),
    role: line.role,
    petId: line.petId,
    planId: line.planId,
    imageUrl: line.imageUrl,
  })),
  payments: value.payments.map((payment) => ({
    id: payment.id,
    paymentAttemptId: payment.paymentAttemptId,
    amount: payment.amount.toString(),
    currency: payment.currency as 'ARS',
    kind: payment.kind,
    provider: payment.provider,
    externalPaymentId: payment.externalPaymentId,
    externalOperationId: payment.externalOperationId,
    method: payment.method,
    reference: payment.reference,
    proofUrl: payment.proofUrl,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  })),
  benefits: value.benefits.map((benefit) => ({
    id: benefit.id,
    type: benefit.type,
    scope: benefit.scope,
    origin: benefit.origin,
    sourceId: benefit.sourceId,
    sourceCode: benefit.sourceCode,
    description: benefit.description,
    percentage: benefit.percentage?.toString() ?? null,
    amount: benefit.amount.toString(),
    currency: benefit.currency,
    metadata: benefit.metadata,
    createdAt: benefit.createdAt,
  })),
});

const toStringRecord = (value: Prisma.JsonValue): Record<string, string> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
};
