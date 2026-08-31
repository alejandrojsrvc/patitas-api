import type {
  AdminProductFilter,
  Brand,
  Category,
  CursorPage,
  CreateProductInput,
  CreateReferenceInput,
  CreateVariantInput,
  CompetitivePriceObservation,
  CreateProductMediaInput,
  FeedingGuide,
  InventoryItem,
  InventoryMovement,
  Page,
  Product,
  ProductMedia,
  ProductVariant,
  MobileProductFilter,
  PublicProductFilter,
  PublicProductFacets,
  SupplierStockStatus,
  UpdateProductInput,
  UpdateReferenceInput,
  UpdateVariantInput,
  ReplaceFeedingGuideInput,
  SetInventoryInput,
} from '../catalog.types';

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface ExistingCatalogImportKeys {
  slugs: string[];
  skus: string[];
}

export interface CatalogRepository {
  listPublicProducts(filter: PublicProductFilter): Promise<Page<Product>>;
  listPublicProductFacets(
    filter: PublicProductFilter,
  ): Promise<PublicProductFacets>;
  listCalculatorProjection(): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      species: string | null;
      lifeStage: string | null;
      estimatedDailyGramsPerKg: string | null;
      variants: Array<{
        id: string;
        presentation: string | null;
        weightGrams: number | null;
      }>;
    }>
  >;
  listSitemapProjection(): Promise<Array<{ slug: string; updatedAt: Date }>>;
  findPublicProductBySlug(slug: string): Promise<Product | null>;
  listRelatedPublicProducts(
    product: Product,
    limit: number,
  ): Promise<Product[]>;
  findPublicCategoryBySlug(slug: string): Promise<Category | null>;
  findPublicBrandBySlug(slug: string): Promise<Brand | null>;
  listMobileProducts(filter: MobileProductFilter): Promise<CursorPage<Product>>;
  listPurchasedVariantIds(customerId: string): Promise<string[]>;
  findActiveFeedingGuide(productId: string): Promise<FeedingGuide | null>;
  listAdminProducts(filter: AdminProductFilter): Promise<Page<Product>>;
  listAllAdminProducts(): Promise<Product[]>;
  findExistingCatalogImportKeys(
    slugs: string[],
    skus: string[],
  ): Promise<ExistingCatalogImportKeys>;
  findProductById(id: string): Promise<Product | null>;
  findProductBySlug(slug: string): Promise<Product | null>;
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
  listCompetitivePriceObservations(
    variantId: string,
  ): Promise<CompetitivePriceObservation[]>;
  listCategories(publicOnly: boolean): Promise<Category[]>;
  createCategory(
    input: CreateReferenceInput & { slug: string },
  ): Promise<Category>;
  updateCategory(id: string, input: UpdateReferenceInput): Promise<Category>;
  listBrands(publicOnly: boolean): Promise<Brand[]>;
  createBrand(input: CreateReferenceInput & { slug: string }): Promise<Brand>;
  updateBrand(id: string, input: UpdateReferenceInput): Promise<Brand>;
}
