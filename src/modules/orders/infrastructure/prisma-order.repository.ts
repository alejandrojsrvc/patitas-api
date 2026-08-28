import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  OrderConflictError,
  OrderNotFoundError,
  OrderValidationError,
} from '../domain/order.error';
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

const orderInclude = {
  lines: { orderBy: { id: 'asc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
} as const;

type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type OrderInventoryTransaction = Pick<
  PrismaService,
  | 'inventoryItem'
  | 'inventoryMovement'
  | 'couponRedemption'
  | 'coupon'
  | 'promotion'
>;

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
        where: { id: { in: variantIds }, active: true },
        include: { product: true },
      });
      if (variants.length !== new Set(variantIds).size)
        throw new OrderValidationError(
          'Una variante no existe o no está activa.',
        );
      const byId = new Map(variants.map((variant) => [variant.id, variant]));
      const lines = input.lines.map((line) => {
        const variant = byId.get(line.variantId);
        if (!variant?.salePrice)
          throw new OrderValidationError(
            'Todas las variantes deben tener precio.',
          );
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
      const subtotal = lines.reduce(
        (sum, line) => sum + Number(line.lineTotal),
        0,
      );
      const shippingCost = Number(input.shippingCost ?? '0');
      const created = await transaction.order.create({
        data: {
          id: randomUUID(),
          customerId: input.customerId ?? null,
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
          lines: {
            create: lines.map((line) => ({ id: randomUUID(), ...line })),
          },
        },
        include: { lines: true },
      });
      await reserve(transaction, created.lines, created.id);
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new OrderNotFoundError();
      throw error;
    }
  }

  public async registerPayment(
    id: string,
    input: RegisterPaymentInput,
  ): Promise<Order> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!order) throw new OrderNotFoundError();
      if (!['DRAFT', 'PENDING_PAYMENT'].includes(order.status))
        throw new OrderConflictError(
          'No se puede registrar un pago en el estado actual del pedido.',
        );
      const paid =
        order.payments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        ) + Number(input.amount);
      if (order.paymentStatus === 'PAID' || paid > Number(order.total))
        throw new OrderConflictError(
          'El importe supera el saldo pendiente del pedido.',
        );
      await transaction.orderPayment.create({
        data: {
          id: randomUUID(),
          orderId: id,
          amount: input.amount,
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
        include: { lines: true },
      });
      if (!order) throw new OrderNotFoundError();
      if (order.status === status && status === 'CANCELLED')
        return mapOrder(
          await transaction.order.findUniqueOrThrow({
            where: { id },
            include: orderInclude,
          }),
        );
      if (!allowedTransitions[order.status].includes(status))
        throw new OrderConflictError(
          `No se puede pasar de ${order.status} a ${status}.`,
        );
      if (status === 'PAID' && order.paymentStatus !== 'PAID')
        throw new OrderConflictError(
          'El pedido debe tener un pago completo antes de marcarse como PAID.',
        );
      if (status === 'PAID')
        await ensureReservation(transaction, order.lines, id);
      if (status === 'SHIPPED') await ship(transaction, order.lines, id);
      if (status === 'CANCELLED') {
        await release(transaction, order.lines, id);
        if (order.paymentStatus !== 'PAID')
          await reverseCouponRedemptions(transaction, id);
      }
      await transaction.order.update({ where: { id }, data: { status } });
      return mapOrder(
        await transaction.order.findUniqueOrThrow({
          where: { id },
          include: orderInclude,
        }),
      );
    });
  }

  public async uploadPaymentProof(
    id: string,
    input: UploadPaymentProofInput,
  ): Promise<Order> {
    return this.prisma.$transaction(async (transaction) => {
      const payment = await transaction.orderPayment.findUnique({
        where: { id: input.paymentId },
        select: { orderId: true },
      });
      if (!payment || payment.orderId !== id)
        throw new OrderConflictError('El pago no pertenece al pedido.');
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

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const allowedTransitions: Record<Order['status'], Order['status'][]> = {
  DRAFT: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const reserve = async (
  transaction: OrderInventoryTransaction,
  lines: Array<{ variantId: string; quantity: number }>,
  orderId: string,
) => {
  for (const line of lines) {
    const inventory = await transaction.inventoryItem.findUnique({
      where: { variantId: line.variantId },
    });
    if (!inventory || inventory.onHand - inventory.reserved < line.quantity)
      throw new OrderConflictError(
        'No hay stock suficiente para reservar el pedido.',
      );
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

const ensureReservation = async (
  transaction: OrderInventoryTransaction,
  lines: Array<{ variantId: string; quantity: number }>,
  orderId: string,
) => {
  for (const line of lines) {
    const existing = await transaction.inventoryMovement.findFirst({
      where: { orderId, variantId: line.variantId, type: 'RESERVE' },
    });
    if (!existing) await reserve(transaction, [line], orderId);
  }
};

const release = async (
  transaction: OrderInventoryTransaction,
  lines: Array<{ variantId: string; quantity: number }>,
  orderId: string,
) => {
  for (const line of lines) {
    const inventory = await transaction.inventoryItem.findUnique({
      where: { variantId: line.variantId },
    });
    const quantity = Math.min(
      line.quantity,
      Math.max(0, inventory?.reserved ?? 0),
    );
    if (!quantity) continue;
    await transaction.inventoryItem.update({
      where: { variantId: line.variantId },
      data: { reserved: { decrement: quantity } },
    });
    await transaction.inventoryMovement.create({
      data: {
        id: randomUUID(),
        variantId: line.variantId,
        orderId,
        type: 'RELEASE',
        quantity,
        reason: 'Cancelación de pedido',
      },
    });
  }
};

const ship = async (
  transaction: OrderInventoryTransaction,
  lines: Array<{ variantId: string; quantity: number }>,
  orderId: string,
) => {
  for (const line of lines) {
    const inventory = await transaction.inventoryItem.findUnique({
      where: { variantId: line.variantId },
    });
    if (
      !inventory ||
      inventory.reserved < line.quantity ||
      inventory.onHand < line.quantity
    )
      throw new OrderConflictError(
        'El inventario reservado no permite despachar el pedido.',
      );
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

const reverseCouponRedemptions = async (
  transaction: OrderInventoryTransaction,
  orderId: string,
) => {
  const redemptions = await transaction.couponRedemption.findMany({
    where: { orderId },
    select: { id: true, couponId: true },
  });
  for (const redemption of redemptions) {
    await transaction.couponRedemption.delete({
      where: { id: redemption.id },
    });
    await transaction.coupon.update({
      where: { id: redemption.couponId },
      data: { redemptionCount: { decrement: 1 } },
    });
    const coupon = await transaction.coupon.findUniqueOrThrow({
      where: { id: redemption.couponId },
      select: { promotionId: true },
    });
    await transaction.promotion.update({
      where: { id: coupon.promotionId },
      data: { redemptionCount: { decrement: 1 } },
    });
  }
};

const mapOrder = (value: OrderRecord): Order => ({
  id: value.id,
  customerId: value.customerId,
  status: value.status,
  paymentStatus: value.paymentStatus,
  paymentMethod: value.paymentMethod,
  paymentReference: value.paymentReference,
  currency: 'ARS',
  subtotal: value.subtotal.toString(),
  shippingCost: value.shippingCost.toString(),
  total: value.total.toString(),
  contactName: value.contactName,
  contactEmail: value.contactEmail,
  contactPhone: value.contactPhone,
  shippingAddress: toStringRecord(value.shippingAddress),
  notes: value.notes,
  trackingNumber: value.trackingNumber,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
  availableTransitions: allowedTransitions[value.status] ?? [],
  lines: value.lines.map((line) => ({
    id: line.id,
    variantId: line.variantId,
    productName: line.productName,
    sku: line.sku,
    presentation: line.presentation,
    unitPrice: line.unitPrice.toString(),
    quantity: line.quantity,
    lineTotal: line.lineTotal.toString(),
  })),
  payments: value.payments.map((payment) => ({
    id: payment.id,
    amount: payment.amount.toString(),
    method: payment.method,
    reference: payment.reference,
    proofUrl: payment.proofUrl,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  })),
});

const toStringRecord = (value: Prisma.JsonValue): Record<string, string> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};
