export interface ProductViewStats {
  productId: string;
  from: string;
  to: string;
  totalViews: number;
  uniqueViews: number;
  daily: Array<{ date: string; totalViews: number; uniqueViews: number }>;
}
