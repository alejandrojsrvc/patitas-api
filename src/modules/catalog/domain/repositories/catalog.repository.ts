import type {
  AdminProductFilter,
  Brand,
  Category,
  CreateProductInput,
  CreateReferenceInput,
  CreateVariantInput,
  CreateProductMediaInput,
  FeedingGuide,
  InventoryItem,
  InventoryMovement,
  Page,
  Product,
  ProductMedia,
  ProductVariant,
  PublicProductFilter,
  SupplierStockStatus,
  UpdateProductInput,
  UpdateReferenceInput,
  UpdateVariantInput,
  ReplaceFeedingGuideInput,
  SetInventoryInput,
} from '../catalog.types';

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface CatalogRepository {
  listPublicProducts(filter: PublicProductFilter): Promise<Page<Product>>;
  findPublicProductBySlug(slug: string): Promise<Product | null>;
  listRelatedPublicProducts(
    product: Product,
    limit: number,
  ): Promise<Product[]>;
  findPublicCategoryBySlug(slug: string): Promise<Category | null>;
  findPublicBrandBySlug(slug: string): Promise<Brand | null>;
  findActiveFeedingGuide(productId: string): Promise<FeedingGuide | null>;
  listAdminProducts(filter: AdminProductFilter): Promise<Page<Product>>;
  findProductById(id: string): Promise<Product | null>;
  findProductByVariantId(id: string): Promise<Product | null>;
  findCategoryById(id: string): Promise<Category | null>;
  findBrandById(id: string): Promise<Brand | null>;
  findSupplierOfferFulfillment(
    variantId: string,
    offerId: string,
  ): Promise<{
    stockStatus: SupplierStockStatus;
    leadTimeHours: number | null;
  } | null>;
  createProduct(input: CreateProductInput & { slug: string }): Promise<Product>;
  updateProduct(id: string, input: UpdateProductInput): Promise<Product>;
  createVariant(
    productId: string,
    input: CreateVariantInput,
  ): Promise<ProductVariant>;
  updateVariant(id: string, input: UpdateVariantInput): Promise<ProductVariant>;
  createProductMedia(
    productId: string,
    input: CreateProductMediaInput,
  ): Promise<ProductMedia>;
  updateProductMedia(
    id: string,
    input: Partial<CreateProductMediaInput>,
  ): Promise<ProductMedia>;
  deleteProductMedia(id: string): Promise<void>;
  replaceFeedingGuide(
    productId: string,
    input: ReplaceFeedingGuideInput,
  ): Promise<FeedingGuide>;
  setInventory(
    variantId: string,
    input: SetInventoryInput,
  ): Promise<InventoryItem>;
  listInventoryMovements(variantId: string): Promise<InventoryMovement[]>;
  listCategories(publicOnly: boolean): Promise<Category[]>;
  createCategory(
    input: CreateReferenceInput & { slug: string },
  ): Promise<Category>;
  updateCategory(id: string, input: UpdateReferenceInput): Promise<Category>;
  listBrands(publicOnly: boolean): Promise<Brand[]>;
  createBrand(input: CreateReferenceInput & { slug: string }): Promise<Brand>;
  updateBrand(id: string, input: UpdateReferenceInput): Promise<Brand>;
}
