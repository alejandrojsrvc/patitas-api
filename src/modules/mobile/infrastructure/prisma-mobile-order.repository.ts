import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  MobileOrder,
  MobileOrderListInput,
  MobileOrderPage,
  MobileOrderFilter,
  MobileOrderRepository,
  MobilePurchaseHistory,
} from '../domain/mobile-order.repository';
import { MobileOrderQueryError } from '../domain/mobile-order.repository';

const mobileOrderInclude = {
  lines: {
    orderBy: { id: 'asc' as const },
    include: {
      pet: { select: { id: true, name: true, species: true } },
      plan: { select: { id: true, status: true } },
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const } },
  statusEvents: { orderBy: { occurredAt: 'asc' as const } },
} as const;

type MobileOrderRecord = Prisma.OrderGetPayload<{
  include: typeof mobileOrderInclude;
}>;

@Injectable()
export class PrismaMobileOrderRepository implements MobileOrderRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(
    customerId: string,
    input: MobileOrderListInput,
  ): Promise<MobileOrderPage> {
    const decodedCursor = decodeCursor(input.cursor);
    const where = {
      customerId,
      ...statusFilter(input.filter),
    };
    const orders = await this.prisma.order.findMany({
      where,
      include: mobileOrderInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(decodedCursor ? { cursor: { id: decodedCursor.id }, skip: 1 } : {}),
      take: input.limit + 1,
    });
    const hasNext = orders.length > input.limit;
    const page = hasNext ? orders.slice(0, input.limit) : orders;
    return {
      items: page.map(mapMobileOrder),
      nextCursor: hasNext
        ? encodeCursor({ id: page[page.length - 1].id })
        : null,
    };
  }

  public async find(
    customerId: string,
    orderId: string,
  ): Promise<MobileOrder | null> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: mobileOrderInclude,
    });
    return order ? mapMobileOrder(order) : null;
  }

  public async purchaseHistory(
    customerId: string,
    petId: string,
  ): Promise<MobilePurchaseHistory> {
    const lines = await this.prisma.orderLine.findMany({
      where: { petId, order: { customerId } },
      include: {
        order: {
          select: {
            id: true,
            number: true,
            currency: true,
            createdAt: true,
            statusEvents: {
              where: { status: 'DELIVERED' },
              orderBy: { occurredAt: 'desc' },
              take: 1,
            },
          },
        },
        variant: { include: { product: { select: { id: true, name: true } } } },
        plan: { select: { bagStartedAt: true } },
      },
      orderBy: { order: { createdAt: 'desc' } },
      take: 100,
    });
    const items = lines.map((line) => ({
      orderId: line.order.id,
      orderNumber: line.order.number,
      orderedAt: line.order.createdAt,
      deliveredAt: line.order.statusEvents[0]?.occurredAt ?? null,
      productId: line.variant.product.id,
      variantId: line.variantId,
      name: line.productName || line.variant.product.name,
      presentation: line.presentation,
      quantity: line.quantity,
      unitPrice: line.unitPrice.toString(),
      currency: line.order.currency,
      bagStartedAt: line.plan?.bagStartedAt ?? null,
    }));
    const starts = items
      .map((item) => item.bagStartedAt)
      .filter((date): date is Date => date !== null)
      .sort((left, right) => left.getTime() - right.getTime());
    const intervals = starts
      .slice(1)
      .map((date, index) =>
        Math.round((date.getTime() - starts[index].getTime()) / 86_400_000),
      );
    return {
      items,
      averageConsumptionDays: intervals.length
        ? Math.round(
            intervals.reduce((total, days) => total + days, 0) /
              intervals.length,
          )
        : null,
      nextCursor: null,
    };
  }
}

const statusFilter = (
  filter: MobileOrderFilter,
): {
  status?: {
    in: Array<
      | 'DRAFT'
      | 'PENDING_PAYMENT'
      | 'PAID'
      | 'PROCESSING'
      | 'SHIPPED'
      | 'DELIVERED'
      | 'CANCELLED'
    >;
  };
} => {
  if (filter === 'delivered') return { status: { in: ['DELIVERED'] } };
  if (filter === 'cancelled') return { status: { in: ['CANCELLED'] } };
  if (filter === 'active')
    return {
      status: {
        in: ['DRAFT', 'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED'],
      },
    };
  return {};
};

const encodeCursor = (value: { id: string }): string =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

const decodeCursor = (cursor?: string): { id: string } | null => {
  if (!cursor) return null;
  try {
    const value = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { id?: unknown };
    if (typeof value.id !== 'string' || !value.id) throw new Error();
    return { id: value.id };
  } catch {
    throw new MobileOrderQueryError('El cursor de pedidos no es válido.');
  }
};

const mapMobileOrder = (value: MobileOrderRecord): MobileOrder => ({
  id: value.id,
  customerId: value.customerId,
  number: value.number,
  source: value.source,
  status: value.status,
  paymentStatus: value.paymentStatus,
  paymentMethod: value.paymentMethod,
  paymentReference: value.paymentReference,
  paymentProvider: value.paymentProvider,
  paymentExternalId: value.paymentExternalId,
  paymentExpiresAt: value.paymentExpiresAt,
  canRetry:
    value.status === 'PENDING_PAYMENT' &&
    value.paymentStatus === 'FAILED' &&
    !value.reconciliationRequired &&
    (!value.reservationExpiresAt || value.reservationExpiresAt > new Date()),
  reconciliationRequired: value.reconciliationRequired,
  reconciliationReason: value.reconciliationReason,
  reservationExpiresAt: value.reservationExpiresAt,
  currency: value.currency,
  subtotal: value.subtotal.toString(),
  discountTotal: value.discountTotal.toString(),
  shippingCost: value.shippingCost.toString(),
  shippingMethod: value.shippingMethod,
  shippingEstimate: value.shippingEstimate,
  shippingDeliverySlot: value.shippingDeliverySlot,
  shippingDeliveryDate: value.shippingDeliveryDate,
  total: value.total.toString(),
  contactName: value.contactName,
  contactEmail: value.contactEmail,
  contactPhone: value.contactPhone,
  shippingAddress: toStringRecord(value.shippingAddress),
  deliveryInstructions: value.deliveryInstructions,
  trackingNumber: value.trackingNumber,
  notes: value.notes,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
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
    pet: line.pet,
    plan: line.plan,
  })),
  payments: value.payments.map((payment) => ({
    id: payment.id,
    paymentAttemptId: payment.paymentAttemptId,
    amount: payment.amount.toString(),
    currency: payment.currency,
    kind: payment.kind,
    provider: payment.provider,
    externalPaymentId: payment.externalPaymentId,
    externalOperationId: payment.externalOperationId,
    method: payment.method,
    reference: payment.reference,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  })),
  statusEvents: value.statusEvents.map((event) => ({
    id: event.id,
    status: event.status,
    occurredAt: event.occurredAt,
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
