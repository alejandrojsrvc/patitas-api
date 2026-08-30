import type { PaymentInitiation } from '../../payments/domain/payment.repository';
import type { CheckoutSession } from '../../checkout/domain/checkout.types';
import type {
  MobileOrder,
  MobileOrderPage,
} from '../domain/mobile-order.repository';

export const toMobileCheckout = (session: CheckoutSession) => ({
  id: session.id,
  cartId: session.cartId,
  status: session.status,
  stage: session.stage,
  contact: {
    name: session.contactName,
    email: session.contactEmail,
    phone: session.contactPhone,
  },
  delivery: {
    address: session.shippingAddress,
    instructions: session.deliveryInstructions,
    shippingOptionId: session.shippingOptionId,
    shippingZoneId: session.shippingZoneId,
    estimate: session.shippingEstimate,
    slot: session.shippingDeliverySlot,
    date: session.shippingDeliveryDate,
  },
  payment: {
    method: session.paymentMethod,
    savedPaymentMethodId: session.savedPaymentMethodId,
  },
  couponCode: session.couponCode,
  items: session.items,
  totals: {
    currency: 'ARS',
    subtotal: session.subtotal,
    discount: session.discountTotal,
    discountTotal: session.discountTotal,
    shipping: session.shippingCost,
    shippingCost: session.shippingCost,
    total: session.total,
  },
  orderId: session.orderId,
  expiresAt: session.expiresAt,
});

export const toMobilePayment = (
  payment: PaymentInitiation | null,
  order?: MobileOrder,
) => ({
  orderId: payment?.orderId ?? order?.id ?? null,
  provider: payment?.provider ?? order?.paymentProvider ?? null,
  status: normalizePaymentStatus(payment?.status, order?.paymentStatus),
  paymentStatus: payment?.paymentStatus ?? order?.paymentStatus ?? 'UNPAID',
  action: payment?.action ?? 'NONE',
  paymentUrl: payment?.paymentUrl ?? null,
  externalId: payment?.externalId ?? order?.paymentExternalId ?? null,
  expiresAt: payment?.expiresAt ?? order?.paymentExpiresAt ?? null,
  canRetry: payment?.canRetry ?? order?.canRetry ?? false,
  reconciliationRequired:
    payment?.reconciliationRequired ?? order?.reconciliationRequired ?? false,
  transactions: order?.payments ?? [],
});

export const toMobileOrder = (order: MobileOrder) => ({
  id: order.id,
  number: order.number,
  source: order.source,
  status: normalizeOrderStatus(order.status),
  paymentStatus: normalizePaymentStatus(undefined, order.paymentStatus),
  timeline: order.statusEvents.map((event) => ({
    id: event.id,
    status: normalizeOrderStatus(event.status),
    state: event.id === order.statusEvents.at(-1)?.id ? 'CURRENT' : 'COMPLETED',
    occurredAt: event.occurredAt,
  })),
  delivery: {
    address: order.shippingAddress,
    instructions: order.deliveryInstructions,
    method: order.shippingMethod,
    estimate: order.shippingEstimate,
    slot: order.shippingDeliverySlot,
    date: order.shippingDeliveryDate,
    trackingNumber: order.trackingNumber,
  },
  pet: order.lines.find((line) => line.pet)?.pet ?? null,
  plan: order.lines.find((line) => line.plan)?.plan ?? null,
  lines: order.lines,
  context: {
    customerId: order.customerId,
    contact: {
      name: order.contactName,
      email: order.contactEmail,
      phone: order.contactPhone,
    },
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    canRetry: order.canRetry,
    reconciliationRequired: order.reconciliationRequired,
    reconciliationReason: order.reconciliationReason,
    reservationExpiresAt: order.reservationExpiresAt,
  },
  payment: {
    method: order.paymentMethod,
    provider: order.paymentProvider,
    reference: order.paymentReference,
    externalId: order.paymentExternalId,
    status: normalizePaymentStatus(undefined, order.paymentStatus),
    transactions: order.payments,
  },
  totals: {
    currency: order.currency,
    subtotal: order.subtotal,
    discount: order.discountTotal,
    discountTotal: order.discountTotal,
    shipping: order.shippingCost,
    shippingCost: order.shippingCost,
    total: order.total,
  },
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

export const toMobileOrderPage = (page: MobileOrderPage) => ({
  items: page.items.map(toMobileOrderSummary),
  nextCursor: page.nextCursor,
});

const toMobileOrderSummary = (order: MobileOrder) => {
  const firstLine = order.lines[0];
  const additional = Math.max(0, order.lines.length - 1);
  return {
    id: order.id,
    number: order.number,
    status: normalizeOrderStatus(order.status),
    statusLabel: orderStatusLabel(order.status),
    createdAt: order.createdAt,
    estimatedDelivery: order.shippingDeliveryDate
      ? {
          date: order.shippingDeliveryDate.toISOString().slice(0, 10),
          windowStart: deliveryWindow(order.shippingDeliverySlot).start,
          windowEnd: deliveryWindow(order.shippingDeliverySlot).end,
        }
      : null,
    productSummary: firstLine
      ? `${firstLine.productName}${additional ? ` + ${additional} productos` : ''}`
      : '',
    total: order.total,
    currency: order.currency,
    pet: order.lines.find((line) => line.pet)?.pet ?? null,
  };
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_PAYMENT: 'Pago pendiente',
  PAID: 'Pago aprobado',
  PROCESSING: 'En preparación',
  SHIPPED: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const orderStatusLabel = (status: string): string =>
  ORDER_STATUS_LABELS[status] ?? status;

const deliveryWindow = (
  value: string | null,
): { start: string | null; end: string | null } => {
  if (!value) return { start: null, end: null };
  const [start, end] = value.split('-').map((part) => part.trim());
  return { start: start || null, end: end || null };
};

const normalizeOrderStatus = (status: string): string =>
  status.trim().toUpperCase();

const normalizePaymentStatus = (
  providerStatus?: string,
  orderStatus?: string,
): string => {
  if (providerStatus === 'APPROVED') return 'APPROVED';
  if (providerStatus) return providerStatus.trim().toUpperCase();
  if (orderStatus === 'PAID') return 'APPROVED';
  return orderStatus?.trim().toUpperCase() ?? 'UNPAID';
};
