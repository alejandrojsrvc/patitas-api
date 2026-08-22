export type CartStatus = 'ACTIVE' | 'ABANDONED' | 'CONVERTED' | 'EXPIRED';

export interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  slug: string;
  sku: string | null;
  presentation: string | null;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  availableQuantity: number;
}

export interface Cart {
  id: string;
  customerId: string | null;
  status: CartStatus;
  currency: 'ARS';
  subtotal: string;
  lastActivityAt: Date;
  items: CartItem[];
}

export interface CartOwner {
  customerId?: string;
  tokenHash?: string;
}

export interface CartPage {
  items: Cart[];
  page: number;
  perPage: number;
  total: number;
}
