export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'CHARGED_BACK';

export type OrderPaymentKind = 'PAYMENT' | 'REFUND' | 'CHARGEBACK';

export interface OrderLine {
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
}

export interface OrderPayment {
  id: string;
  paymentAttemptId: string | null;
  amount: string;
  currency: 'ARS';
  kind: OrderPaymentKind;
  provider: string | null;
  externalPaymentId: string | null;
  externalOperationId: string | null;
  method: string;
  reference: string | null;
  proofUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface Order {
  id: string;
  customerId: string | null;
  number: string | null;
  source: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  canRetry: boolean;
  reconciliationRequired: boolean;
  reconciliationReason: string | null;
  reservationExpiresAt: Date | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  currency: 'ARS';
  subtotal: string;
  shippingCost: string;
  shippingProviderCost: string;
  shippingSubsidy: string;
  shippingDeliveryCount: number;
  shippingVat: string;
  shippingDeliverySlot: string | null;
  shippingDeliveryDate: Date | null;
  total: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  shippingAddress: Record<string, string>;
  deliveryInstructions: string | null;
  notes: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  availableTransitions: OrderStatus[];
  statusEvents: Array<{ id: string; status: OrderStatus; occurredAt: Date }>;
  lines: OrderLine[];
  payments: OrderPayment[];
}

export interface OrderFilter {
  q?: string;
  customerId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  page: number;
  perPage: number;
}

export interface OrderPage {
  items: Order[];
  page: number;
  perPage: number;
  total: number;
}

export interface CreateOrderLineInput {
  variantId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerId?: string;
  source?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  shippingAddress: Record<string, string>;
  shippingCost?: string;
  notes?: string | null;
  deliveryInstructions?: string | null;
  lines: CreateOrderLineInput[];
}

export interface UpdateOrderInput {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string | null;
  shippingAddress?: Record<string, string>;
  notes?: string | null;
  trackingNumber?: string | null;
}

export interface RegisterPaymentInput {
  amount: string;
  method: string;
  reference?: string | null;
  proofUrl?: string | null;
  paidAt?: Date | null;
}

export interface UploadPaymentProofInput {
  paymentId: string;
  storagePath: string;
  originalName: string;
  contentType: string;
  data: Uint8Array;
}
