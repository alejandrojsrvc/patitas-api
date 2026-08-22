export interface ProductViewStats {
  productId: string;
  from: string;
  to: string;
  totalViews: number;
  uniqueViews: number;
  daily: Array<{ date: string; totalViews: number; uniqueViews: number }>;
}

export interface RecentlyViewedProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string } | null;
  imageUrl: string | null;
  viewedAt: Date;
  variants: Array<{
    id: string;
    presentation: string | null;
    salePrice: string;
    availableQuantity: number;
  }>;
}
