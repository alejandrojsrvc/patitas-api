export type CartStatus = 'ACTIVE' | 'ABANDONED' | 'CONVERTED' | 'EXPIRED';
export type CartSource = 'STORE' | 'MOBILE';
export type CartItemRole = 'MAIN' | 'EXTRA';

export interface CartItemContext {
  role: CartItemRole;
  petId?: string | null;
  planId?: string | null;
}

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
  weightGrams?: number | null;
  availableQuantity: number;
  role: CartItemRole;
  petId: string | null;
  planId: string | null;
}

export interface Cart {
  id: string;
  customerId: string | null;
  status: CartStatus;
  currency: 'ARS';
  subtotal: string;
  lastActivityAt: Date;
  items: CartItem[];
  source: CartSource;
}

export interface CartSummary {
  id: string | null;
  itemCount: number;
  subtotal: string;
  currency: 'ARS';
}

export interface CartOwner {
  customerId?: string;
  tokenHash?: string;
  source?: CartSource;
}

export interface CartPage {
  items: Cart[];
  page: number;
  perPage: number;
  total: number;
}
