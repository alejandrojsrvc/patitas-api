export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus =
  'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface OrderLine {
  id: string;
  variantId: string;
  productName: string;
  sku: string | null;
  presentation: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderPayment {
  id: string;
  amount: string;
  method: string;
  reference: string | null;
  proofUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface Order {
  id: string;
  customerId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  currency: 'ARS';
  subtotal: string;
  shippingCost: string;
  total: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  shippingAddress: Record<string, string>;
  notes: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  availableTransitions: OrderStatus[];
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
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  shippingAddress: Record<string, string>;
  shippingCost?: string;
  notes?: string | null;
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
