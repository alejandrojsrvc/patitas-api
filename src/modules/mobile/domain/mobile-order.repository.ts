import type {
  OrderStatus,
  PaymentStatus,
} from '../../orders/domain/order.types';
import { DomainError } from '../../../shared/domain/domain-error';

export const MOBILE_ORDER_REPOSITORY = Symbol('MOBILE_ORDER_REPOSITORY');

export type MobileOrderFilter = 'active' | 'delivered' | 'cancelled' | 'all';

export interface MobileOrderListInput {
  filter: MobileOrderFilter;
  cursor?: string;
  limit: number;
}

export class MobileOrderQueryError extends DomainError {
  public constructor(message: string) {
    super(message, 'MOBILE_ORDER_QUERY_INVALID');
  }
}

export interface MobileOrderLine {
  id: string;
  variantId: string;
  productName: string;
  sku: string | null;
  presentation: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  role: string;
  petId: string | null;
  planId: string | null;
  imageUrl: string | null;
  pet: { id: string; name: string; species: string } | null;
  plan: { id: string; status: string } | null;
}

export interface MobileOrderPayment {
  id: string;
  paymentAttemptId: string | null;
  amount: string;
  currency: string;
  kind: string;
  provider: string | null;
  externalPaymentId: string | null;
  externalOperationId: string | null;
  method: string;
  reference: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface MobileOrderStatusEvent {
  id: string;
  status: OrderStatus;
  occurredAt: Date;
}

export interface MobileOrder {
  id: string;
  customerId: string | null;
  number: string | null;
  source: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentProvider: string | null;
  paymentExternalId: string | null;
  paymentExpiresAt: Date | null;
  canRetry: boolean;
  reconciliationRequired: boolean;
  reconciliationReason: string | null;
  reservationExpiresAt: Date | null;
  currency: string;
  subtotal: string;
  discountTotal: string;
  shippingCost: string;
  shippingMethod: string | null;
  shippingEstimate: string | null;
  shippingDeliverySlot: string | null;
  shippingDeliveryDate: Date | null;
  total: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  shippingAddress: Record<string, string>;
  deliveryInstructions: string | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: MobileOrderLine[];
  payments: MobileOrderPayment[];
  statusEvents: MobileOrderStatusEvent[];
}

export interface MobileOrderPage {
  items: MobileOrder[];
  nextCursor: string | null;
}

export interface MobilePurchaseHistory {
  items: Array<{
    orderId: string;
    orderNumber: string | null;
    orderedAt: Date;
    deliveredAt: Date | null;
    productId: string;
    variantId: string;
    name: string;
    presentation: string | null;
    quantity: number;
    unitPrice: string;
    currency: string;
    bagStartedAt: Date | null;
  }>;
  averageConsumptionDays: number | null;
  nextCursor: string | null;
}

export interface MobileOrderRepository {
  list(
    customerId: string,
    input: MobileOrderListInput,
  ): Promise<MobileOrderPage>;
  find(customerId: string, orderId: string): Promise<MobileOrder | null>;
  purchaseHistory(
    customerId: string,
    petId: string,
  ): Promise<MobilePurchaseHistory>;
}
