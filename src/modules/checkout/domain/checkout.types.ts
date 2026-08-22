import type { CartItem } from '../../cart/domain/cart.types';

export type CheckoutStage = 'CONTACT' | 'SHIPPING' | 'PAYMENT' | 'CONFIRMATION';
export type CheckoutStatus = 'DRAFT' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface CheckoutOwner {
  customerId?: string;
  tokenHash?: string;
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
  shippingOptionId: string | null;
  shippingCost: string;
  shippingZoneId: string | null;
  shippingEstimate: string | null;
  paymentMethod: string | null;
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
  subtotal: string;
  discountTotal: string;
  shippingCost: string;
  total: string;
  currency: 'ARS';
  contactName: string;
  contactEmail: string;
  lines: Array<{
    variantId: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  createdAt: Date;
}
