export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  displayOrder: number;
  parentId: string | null;
  active: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  logoUrl: string | null;
  displayOrder: number;
  active: boolean;
}

export interface ProductMedia {
  id: string;
  url: string;
  altText: string;
  displayOrder: number;
  variantId: string | null;
}

export interface InventoryItem {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
}

export interface InventoryMovement {
  id: string;
  variantId: string;
  orderId: string | null;
  type: 'RESERVE' | 'RELEASE' | 'SHIP' | 'ADJUSTMENT';
  quantity: number;
  reason: string | null;
  createdAt: Date;
}

export type SupplierStockStatus =
  'AVAILABLE' | 'OUT_OF_STOCK' | 'ON_REQUEST' | 'UNKNOWN';

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
  presentation: string | null;
  weightGrams: number | null;
  salePrice: string | null;
  compareAtPrice: string | null;
  active: boolean;
  preferredSupplierOfferId: string | null;
  revision: number;
  availableQuantity: number;
  supplierStockStatus: SupplierStockStatus | null;
  supplierLeadTimeHours: number | null;
  onHand?: number;
  reserved?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ingredientsText: string | null;
  analyticalComposition: Record<string, unknown> | null;
  brandId: string;
  categoryId: string | null;
  species: string | null;
  line: string | null;
  lifeStage: string | null;
  breedSize: string | null;
  estimatedDailyGramsPerKg: string | null;
  featuredRank: number | null;
  status: ProductStatus;
  brand: Brand;
  category: Category | null;
  variants: ProductVariant[];
  media: ProductMedia[];
}

export interface FeedingGuideEntry {
  petWeightKgMin: number;
  petWeightKgMax: number | null;
  lifeStage: string | null;
  conditions: Record<string, string>;
  dailyGramsMin: number;
  dailyGramsMax: number | null;
}

export interface FeedingGuide {
  id: string;
  productId: string;
  sourceLabel: string;
  sourceUrl: string | null;
  requiredDimensions: Record<string, string[]>;
  entries: FeedingGuideEntry[];
}

export interface PublicProductDetail {
  product: Product;
  feedingGuide: FeedingGuide | null;
  relatedProducts: Product[];
}

export interface CompetitivePriceObservation {
  retailerCode: string;
  price: string | null;
  currency: string;
  availability: string;
  matchStatus: 'MATCHED' | 'MISMATCH' | 'MISSING' | 'AMBIGUOUS' | 'BLOCKED';
  observedAt: Date;
  sourceUrl: string;
}

export interface CompetitivePriceAverage {
  currency: string;
  averagePrice: string | null;
  sampleCount: number;
  expectedRetailerCount: number;
  retailers: Array<{
    retailerCode: string;
    price: string | null;
    observedAt: Date | null;
    sourceUrl: string | null;
  }>;
}

export interface ReplaceFeedingGuideInput {
  sourceLabel: string;
  sourceUrl?: string | null;
  requiredDimensions?: Record<string, string[]>;
  entries: FeedingGuideEntry[];
}

export interface CreateProductMediaInput {
  variantId?: string | null;
  url: string;
  altText: string;
  displayOrder?: number;
}

export interface UploadProductMediaInput {
  variantId?: string | null;
  altText?: string | null;
  displayOrder?: number;
  originalName: string;
  contentType: string;
  data: Uint8Array;
}

export interface SetInventoryInput {
  onHand: number;
  reserved: number;
  reason?: string | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
}

export interface PublicProductFilter {
  q?: string;
  category?: string;
  brand?: string | string[];
  species?: string;
  minPrice?: string;
  maxPrice?: string;
  lifeStage?: string | string[];
  weightGrams?: number | number[];
  featured?: boolean;
  sort?: 'featured' | 'name_asc' | 'price_asc' | 'price_desc';
  page: number;
  perPage: number;
}

export interface AdminProductFilter {
  status?: ProductStatus;
  q?: string;
  brandId?: string;
  categoryId?: string;
  species?: string;
  hasStock?: boolean;
  sort?: 'name_asc' | 'name_desc' | 'updated_desc';
  page: number;
  perPage: number;
}

export interface CreateReferenceInput {
  name: string;
  slug?: string;
  active?: boolean;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  displayOrder?: number;
  parentId?: string | null;
  logoUrl?: string | null;
}

export interface UpdateReferenceInput {
  name?: string;
  slug?: string;
  active?: boolean;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  displayOrder?: number;
  parentId?: string | null;
  logoUrl?: string | null;
}

export interface CreateProductInput {
  name: string;
  slug?: string;
  description?: string | null;
  ingredientsText?: string | null;
  analyticalComposition?: Record<string, unknown> | null;
  brandId: string;
  categoryId: string;
  species?: string | null;
  line?: string | null;
  lifeStage?: string | null;
  breedSize?: string | null;
  estimatedDailyGramsPerKg?: string | null;
  featuredRank?: number | null;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  status?: ProductStatus;
}

export interface CreateVariantInput {
  sku?: string | null;
  barcode?: string | null;
  presentation?: string | null;
  weightGrams?: number | null;
  active?: boolean;
}

export interface UpdateVariantInput extends CreateVariantInput {
  salePrice?: string | null;
  compareAtPrice?: string | null;
  preferredSupplierOfferId?: string | null;
}
