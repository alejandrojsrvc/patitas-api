import type { CartItem } from '../../cart/domain/cart.types';

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
  items: CartItem[];
  expiresAt: Date;
}

export interface OrderSummary {
  id: string;
  status: string;
  paymentStatus: string;
  canRetry: boolean;
  reconciliationRequired: boolean;
  reconciliationReason: string | null;
  reservationExpiresAt: Date | null;
  subtotal: string;
  discountTotal: string;
  shippingCost: string;
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
  createdAt: Date;
}
