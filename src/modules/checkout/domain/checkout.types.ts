import type { CartItem } from '../../cart/domain/cart.types';
import type { CheckoutBenefit, CheckoutPricingActions, CheckoutPricingConflict } from './checkout-pricing';

export type CheckoutStage = 'CONTACT' | 'SHIPPING' | 'PAYMENT' | 'CONFIRMATION';
export type CheckoutStatus = 'DRAFT' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface CheckoutOwner {
  customerId?: string;
  tokenHash?: string;
  source?: 'STORE' | 'MOBILE';
}

export interface CheckoutSession {
  id: string;
  cartId: string;
  customerId: string | null;
  stage: CheckoutStage;
  status: CheckoutStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  shippingAddress: Record<string, string> | null;
  deliveryInstructions: string | null;
  shippingOptionId: string | null;
  shippingCost: string;
  shippingZoneId: string | null;
  shippingEstimate: string | null;
  shippingDeliverySlot: string | null;
  shippingDeliveryDate: Date | null;
  paymentMethod: string | null;
  savedPaymentMethodId: string | null;
  couponCode: string | null;
  orderId: string | null;
  subtotal: string;
  discountTotal: string;
  total: string;
  pricing: {
    productDiscountTotal: string;
    paymentDiscountTotal: string;
    shippingDiscountTotal: string;
    benefits: CheckoutBenefit[];
    conflicts: CheckoutPricingConflict[];
    shippingThreshold: {
      threshold: string | null;
      eligibleAmount: string;
      remaining: string | null;
    };
  };
  actions: CheckoutPricingActions;
  scheduledPurchase?: {
    id: string;
    frequencyDays: number;
    discountPercent: string;
    leadDays: number;
    status: string;
  } | null;
  items: CartItem[];
  expiresAt: Date;
}

export interface OrderSummary {
  id: string;
  number: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentProvider: string | null;
  canRetry: boolean;
  reconciliationRequired: boolean;
  reconciliationReason: string | null;
  reservationExpiresAt: Date | null;
  subtotal: string;
  discountTotal: string;
  shippingCost: string;
  shippingAddress: Record<string, unknown>;
  deliveryInstructions: string | null;
  shippingEstimate: string | null;
  shippingDeliveryDate: Date | null;
  shippingDeliverySlot: string | null;
  trackingNumber: string | null;
  total: string;
  currency: 'ARS';
  contactName: string;
  contactEmail: string;
  petName: string | null;
  date: Date;
  lines: Array<{
    variantId: string;
    productName: string;
    presentation: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  benefits: Array<{
    id: string;
    type: string;
    scope: string;
    origin: string;
    sourceId: string | null;
    sourceCode: string | null;
    description: string;
    percentage: string | null;
    amount: string;
    currency: string;
    metadata: unknown;
    createdAt: Date;
  }>;
  createdAt: Date;
  payments: Array<{
    id: string;
    amount: string;
    currency: string;
    method: string;
    provider: string | null;
    externalPaymentId: string | null;
    paidAt: Date | null;
    createdAt: Date;
  }>;
  statusEvents: Array<{ id: string; status: string; occurredAt: Date }>;
  shipment: {
    id: string;
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    estimatedDate: Date | null;
    estimatedSlot: string | null;
    events: Array<{ id: string; status: string; visibleMessage: string; occurredAt: Date }>;
  } | null;
}

export interface CustomerOrderListItem {
  id: string;
  number: string | null;
  status: string;
  paymentStatus: string;
  total: string;
  currency: 'ARS';
  lineCount: number;
  createdAt: Date;
}
