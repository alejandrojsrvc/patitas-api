export interface InventoryListFilter {
  q?: string;
  page: number;
  perPage: number;
}
export interface InventoryRow {
  variantId: string;
  productId: string;
  productName: string;
  sku: string | null;
  presentation: string | null;
  onHand: number;
  reserved: number;
  available: number;
}
export interface InventoryPage {
  items: InventoryRow[];
  page: number;
  perPage: number;
  total: number;
}
export interface InventoryAdjustment {
  variantId: string;
  quantityDelta: number;
  reason: string;
}
