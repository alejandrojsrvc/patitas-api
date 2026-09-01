import {
  CatalogNotFoundError,
  CatalogValidationError,
} from '../domain/errors/catalog.error';
import type { CatalogRepository } from '../domain/repositories/catalog.repository';
import type {
  AdminProductFilter,
  Brand,
  CreateProductInput,
  CreateProductMediaInput,
  CreateReferenceInput,
  CreateVariantInput,
  Product,
  ProductMedia,
  PublicProductFilter,
  PublicProductDetail,
  ReplaceFeedingGuideInput,
  SetInventoryInput,
  UpdateProductInput,
  UpdateReferenceInput,
  UpdateVariantInput,
  UploadProductMediaInput,
} from '../domain/catalog.types';
import { randomUUID } from 'node:crypto';
import type { StorageProvider } from '../../../shared/application/ports/storage-provider.interface';
import { calculateFoodDuration } from '../domain/feeding-calculator';
import { calculateCompetitivePriceAverage } from '../domain/competitive-price';
import { parseSimpleCatalogCsv } from './simple-catalog-csv';
import type { SupplierOfferImportOptions } from '../../suppliers/domain/repositories/supplier.repository';
import type {
  SupplierOfferImportResult,
  SupplierOfferImportRow,
} from '../../suppliers/domain/supplier.types';
import type { FulfillmentService } from '../../fulfillment/application/fulfillment.service';
import type {
  CatalogCacheInvalidation,
  CatalogCacheInvalidationPort,
} from '../../../shared/application/ports/catalog-cache-invalidation.port';

interface CatalogSupplierOfferImporter {
  importOfferRows(
    rows: SupplierOfferImportRow[],
    options: SupplierOfferImportOptions,
  ): Promise<SupplierOfferImportResult>;
}

export class CatalogService {
  public constructor(
    private readonly repository: CatalogRepository,
    private readonly storage?: StorageProvider,
    private readonly supplierOffers?: CatalogSupplierOfferImporter,
    private readonly fulfillment?: FulfillmentService,
    private readonly cacheInvalidation?: CatalogCacheInvalidationPort,
  ) {}

  public async listPublicProducts(filter: PublicProductFilter) {
    const page = await this.repository.listPublicProducts(filter);
    return {
      ...page,
      items: await this.resolveProducts(page.items),
    };
  }

  public listPublicProductFacets(filter: PublicProductFilter) {
    return this.repository.listPublicProductFacets(filter);
  }

  public listCalculatorProjection() {
    return this.repository.listCalculatorProjection();
  }

  public listSitemapProjection() {
    return this.repository.listSitemapProjection();
  }

  public async getPublicProduct(slug: string) {
    const product = await this.repository.findPublicProductBySlug(slug);
    if (!product) throw new CatalogNotFoundError('El producto');
    return (await this.resolveProducts([product]))[0];
  }

  public async getPublicProductByVariantId(variantId: string) {
    const product = await this.repository.findProductByVariantId(variantId);
    if (
      !product ||
      product.status !== 'ACTIVE' ||
      !product.variants.some((variant) => variant.id === variantId)
    ) {
      throw new CatalogNotFoundError('La variante');
    }
    return (await this.resolveProducts([product]))[0];
  }

  public resolvePublicProduct(product: Product) {
    return this.resolveProductMedia(product);
  }

  public resolvePublicProducts(products: Product[]) {
    return this.resolveProducts(products);
  }

  public async getPublicProductDetail(
    slug: string,
  ): Promise<PublicProductDetail> {
    const rawProduct = await this.repository.findPublicProductBySlug(slug);
    if (!rawProduct) throw new CatalogNotFoundError('El producto');
    const [feedingGuide, relatedProducts] = await Promise.all([
      this.repository.findActiveFeedingGuide(rawProduct.id),
      this.repository.listRelatedPublicProducts(rawProduct, 6),
    ]);
    const resolvedProducts = await this.resolveProducts([
      rawProduct,
      ...relatedProducts,
    ]);
    return {
      product: resolvedProducts[0],
      feedingGuide,
      relatedProducts: resolvedProducts.slice(1),
    };
  }

  public async getPublicCategory(slug: string) {
    const category = await this.repository.findPublicCategoryBySlug(slug);
    if (!category) throw new CatalogNotFoundError('La categoría');
    return category;
  }

  public async getPublicBrand(slug: string) {
    const brand = await this.repository.findPublicBrandBySlug(slug);
    if (!brand) throw new CatalogNotFoundError('La marca');
    return this.resolveBrand(brand);
  }

  public async calculateFoodDuration(input: {
    productSlug: string;
    variantId: string;
    petWeightKg: number;
    lifeStage?: string;
    attributes?: Record<string, string>;
  }) {
    if (
      input.attributes &&
      Object.entries(input.attributes).some(
        ([key, value]) =>
          !key.trim() || typeof value !== 'string' || !value.trim(),
      )
    ) {
      throw new CatalogValidationError(
        'Los atributos de la calculadora deben ser textos no vacíos.',
      );
    }
    const product = await this.getPublicProduct(input.productSlug);
    const variant = product.variants.find(
      (item) => item.id === input.variantId,
    );
    if (!variant?.weightGrams) {
      throw new CatalogValidationError(
        'La variante seleccionada no tiene un peso calculable.',
      );
    }
    const fallbackGramsPerKg =
      Number(product.estimatedDailyGramsPerKg) ||
      defaultFallbackGramsPerKg(product.species);
    if (!Number.isFinite(fallbackGramsPerKg) || fallbackGramsPerKg <= 0) {
      throw new CatalogValidationError(
        'El producto todavía no tiene datos suficientes para calcular una duración.',
      );
    }
    const guide = await this.repository.findActiveFeedingGuide(product.id);
    return calculateFoodDuration(
      {
        petWeightKg: input.petWeightKg,
        presentationGrams: variant.weightGrams,
        lifeStage: input.lifeStage ?? product.lifeStage ?? undefined,
        attributes: input.attributes,
        fallbackGramsPerKg,
      },
      guide,
    );
  }

  public async calculateFoodDurationByIds(input: {
    productId: string;
    variantId: string;
    petWeightKg: number;
    lifeStage?: string;
    attributes?: Record<string, string>;
  }) {
    const product = await this.repository.findProductById(input.productId);
    if (!product || product.status !== 'ACTIVE')
      throw new CatalogValidationError('El producto no se puede vender.');
    if (!product.variants.some((variant) => variant.id === input.variantId))
      throw new CatalogValidationError('La variante no pertenece al producto.');
    return this.calculateFoodDuration({
      productSlug: product.slug,
      variantId: input.variantId,
      petWeightKg: input.petWeightKg,
      lifeStage: input.lifeStage,
      attributes: input.attributes,
    });
  }

  public calculateCustomFoodDuration(input: {
    species: string;
    petWeightKg: number;
    presentationGrams: number;
    lifeStage?: string;
  }) {
    return calculateFoodDuration(
      {
        petWeightKg: input.petWeightKg,
        presentationGrams: input.presentationGrams,
        lifeStage: input.lifeStage,
        fallbackGramsPerKg: defaultFallbackGramsPerKg(input.species),
      },
      null,
    );
  }

  public async listAdminProducts(filter: AdminProductFilter) {
    const page = await this.repository.listAdminProducts(filter);
    return {
      ...page,
      items: await this.resolveProducts(page.items),
    };
  }

  public async listAllAdminProducts() {
    const products = await this.repository.listAllAdminProducts();
    return this.resolveProducts(products);
  }

  public async getAdminProduct(id: string) {
    const product = await this.repository.findProductById(id);
    if (!product) throw new CatalogNotFoundError('El producto');
    return (await this.resolveProducts([product]))[0];
  }

  public async getAdminFeedingGuide(productId: string) {
    await this.ensureProduct(productId);
    return this.repository.findActiveFeedingGuide(productId);
  }

  public async getCompetitivePriceAverage(variantId: string) {
    const product = await this.repository.findProductByVariantId(variantId);
    if (
      !product ||
      !product.variants.some((variant) => variant.id === variantId)
    ) {
      throw new CatalogNotFoundError('La variante');
    }
    return calculateCompetitivePriceAverage(
      await this.repository.listCompetitivePriceObservations(variantId),
    );
  }

  public async createProduct(input: CreateProductInput) {
    if (!input.name.trim())
      throw new CatalogValidationError(
        'El nombre del producto es obligatorio.',
      );
    const [brand, category] = await Promise.all([
      this.repository.findBrandById(input.brandId),
      this.repository.findCategoryById(input.categoryId),
    ]);
    if (!brand?.active || !category?.active) {
      throw new CatalogValidationError(
        'La marca y categoría deben existir y estar activas.',
      );
    }
    const product = await this.repository.createProduct({
      ...input,
      name: input.name.trim(),
      slug: slugify(input.slug ?? input.name),
    });
    this.invalidateCatalogCache();
    return product;
  }

  public async importSimpleCatalogCsv(
    data: Uint8Array,
    options: { publish: boolean },
  ) {
    const rows = parseSimpleCatalogCsv(data);
    const categories = new Map(
      (await this.listCategories(false))
        .filter((item) => item.active)
        .map((item) => [item.slug, item]),
    );
    if (!categories.size) {
      throw new CatalogValidationError(
        'No existen categorías activas para importar.',
      );
    }

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const productRows = grouped.get(row.slug) ?? [];
      productRows.push(row);
      grouped.set(row.slug, productRows);
    }

    const existingKeys = await this.repository.findExistingCatalogImportKeys(
      [...grouped.keys()],
      rows.map((row) => row.sku),
    );
    const existingSlugs = new Set(existingKeys.slugs);
    const existingSkus = new Set(existingKeys.skus);
    const skipped = [...grouped.entries()]
      .filter(
        ([slug, productRows]) =>
          existingSlugs.has(slug) ||
          productRows.some((row) => existingSkus.has(row.sku)),
      )
      .map(([slug, productRows]) => ({
        slug,
        reason: existingSlugs.has(slug) ? 'slug_exists' : 'sku_exists',
        skus: productRows.map((row) => row.sku),
      }));
    const importEntries = [...grouped.entries()].filter(
      ([slug, productRows]) =>
        !existingSlugs.has(slug) &&
        !productRows.some((row) => existingSkus.has(row.sku)),
    );

    const brands = new Map(
      (await this.listBrands(false)).map((brand) => [brand.slug, brand]),
    );
    for (const brandName of new Set(
      importEntries.flatMap(([, productRows]) =>
        productRows.map((row) => row.brand),
      ),
    )) {
      const brandSlug = slugify(brandName);
      if (brands.has(brandSlug)) continue;
      const brand = await this.createBrand({ name: brandName, active: true });
      brands.set(brand.slug, brand);
    }

    const results: Array<{
      slug: string;
      productId: string;
      variants: Array<{
        id: string;
        sku: string | null;
        weightGrams: number | null;
      }>;
      status: Product['status'];
      published: boolean;
      publishError?: string;
    }> = [];
    const supplierOfferRows: SupplierOfferImportRow[] = [];

    const productResults = await mapWithConcurrency(
      importEntries,
      6,
      async ([slug, productRows]) => {
        const first = productRows[0];
        const categorySlug = importCategorySlug(first.category);
        const category = categories.get(categorySlug);
        if (!category) {
          throw new CatalogValidationError(
            `La categoría ${categorySlug} no existe o está inactiva.`,
          );
        }
        let brand = brands.get(slugify(first.brand));
        if (!brand) {
          brand = await this.createBrand({ name: first.brand, active: true });
          brands.set(brand.slug, brand);
        }

        let product = await this.repository.findProductBySlug(slug);
        const productInput = {
          name: first.name,
          slug,
          description: first.description,
          brandId: brand.id,
          categoryId: category.id,
          species: first.species,
          line: first.line,
          lifeStage: first.lifeStage,
          breedSize: first.breedSize,
        };
        const wasExisting = Boolean(product);
        if (product) {
          product = await this.repository.updateProduct(
            product.id,
            productInput,
          );
        } else {
          product = await this.createProduct(productInput);
        }

        const knownImages = new Set(product.media.map((media) => media.url));
        const currentVariants = [...product.variants];
        const importedVariants: Array<{
          id: string;
          sku: string | null;
          weightGrams: number | null;
        }> = [];
        for (const row of productRows) {
          let variant = currentVariants.find(
            (item) =>
              (row.barcode !== null && item.barcode === row.barcode) ||
              item.sku === row.sku ||
              item.weightGrams === row.weightGrams,
          );
          const variantInput = {
            sku: row.sku,
            barcode: row.barcode,
            presentation:
              row.weightGrams === null ? null : `${row.weightGrams / 1000} kg`,
            weightGrams: row.weightGrams,
            active: true,
          };
          if (variant) {
            variant = await this.repository.updateVariant(variant.id, {
              ...variantInput,
              ...(row.salePrice !== null ? { salePrice: row.salePrice } : {}),
            });
          } else {
            variant = await this.createVariant(product.id, variantInput);
            if (row.salePrice !== null) {
              variant = await this.repository.updateVariant(variant.id, {
                salePrice: row.salePrice,
              });
            }
          }
          const existingIndex = currentVariants.findIndex(
            (item) => item.id === variant.id,
          );
          if (existingIndex >= 0) currentVariants[existingIndex] = variant;
          else currentVariants.push(variant);
          importedVariants.push({
            id: variant.id,
            sku: variant.sku,
            weightGrams: variant.weightGrams,
          });
          if (row.supplierName && row.supplierUnitCost) {
            supplierOfferRows.push({
              rowNumber: row.rowNumber,
              supplierId: null,
              supplierName: row.supplierName,
              variantId: variant.id,
              sku: variant.sku,
              barcode: variant.barcode,
              supplierSku: row.supplierSku,
              unitCost: row.supplierUnitCost,
              stockStatus: row.supplierStockStatus,
              leadTimeHours: null,
              minimumQuantity: 1,
              active: true,
            });
          }
          if (row.initialStock !== null) {
            await this.repository.setInventory(variant.id, {
              onHand: row.initialStock,
              reserved: variant.reserved ?? 0,
              reason: 'Importación inicial CSV',
            });
          }
          if (row.imageUrl && !knownImages.has(row.imageUrl)) {
            await this.createProductMedia(product.id, {
              url: row.imageUrl,
              altText: `Imagen de ${row.name}`,
              variantId: null,
              displayOrder: 0,
            });
            knownImages.add(row.imageUrl);
          }
        }

        let published = false;
        let publishError: string | undefined;
        if (options.publish) {
          try {
            await this.updateProduct(product.id, { status: 'ACTIVE' });
            published = true;
          } catch (error) {
            publishError =
              error instanceof Error ? error.message : 'No publicable';
          }
        }
        return {
          slug,
          productId: product.id,
          variants: importedVariants,
          status: published ? 'ACTIVE' : wasExisting ? product.status : 'DRAFT',
          published,
          ...(publishError ? { publishError } : {}),
        };
      },
    );
    results.push(...productResults);
    const supplierOffers =
      supplierOfferRows.length && this.supplierOffers
        ? await this.supplierOffers.importOfferRows(supplierOfferRows, {
            dryRun: false,
            createMissingSuppliers: true,
          })
        : null;
    return {
      rows: rows.length,
      products: results.length,
      published: results.filter((item) => item.published).length,
      draft: results.filter((item) => !item.published).length,
      items: results,
      skipped,
      supplierOffers,
    };
  }

  public async updateProduct(id: string, input: UpdateProductInput) {
    if (input.categoryId === null || input.brandId === null) {
      throw new CatalogValidationError(
        'Marca y categoría no pueden quedar vacías.',
      );
    }
    const current = await this.getAdminProduct(id);
    const category = input.categoryId
      ? await this.repository.findCategoryById(input.categoryId)
      : current.category;
    const brand = input.brandId
      ? await this.repository.findBrandById(input.brandId)
      : current.brand;
    if (!category || !brand) {
      throw new CatalogValidationError(
        'Marca y categoría deben existir y estar activas.',
      );
    }
    const next = {
      ...current,
      categoryId: input.categoryId ?? current.categoryId,
      category,
      brand,
      status: input.status ?? current.status,
    };
    if (next.status === 'ACTIVE') {
      assertPublishable(next);
    }
    const product = await this.repository.updateProduct(id, {
      ...input,
      ...(input.slug ? { slug: slugify(input.slug) } : {}),
    });
    this.invalidateCatalogCache();
    return product;
  }

  public async createVariant(productId: string, input: CreateVariantInput) {
    await this.getAdminProduct(productId);
    const variant = await this.repository.createVariant(
      productId,
      normalizeVariant(input),
    );
    this.invalidateCatalogCache();
    return variant;
  }

  public async updateVariant(id: string, input: UpdateVariantInput) {
    const product = await this.repository.findProductByVariantId(id);
    if (!product) throw new CatalogNotFoundError('La variante');
    const currentVariant = product.variants.find(
      (variant) => variant.id === id,
    );
    if (!currentVariant) throw new CatalogNotFoundError('La variante');
    if (input.preferredSupplierOfferId !== undefined) {
      if (input.preferredSupplierOfferId !== null) {
        const offer = await this.repository.findSupplierOfferFulfillment(
          id,
          input.preferredSupplierOfferId,
        );
        if (!offer) {
          throw new CatalogValidationError(
            'La oferta preferida no pertenece a la variante.',
          );
        }
      }
    }
    const variant = await this.repository.updateVariant(
      id,
      normalizeVariant(input),
    );
    this.invalidateCatalogCache();
    return variant;
  }

  public async createProductMedia(
    productId: string,
    input: CreateProductMediaInput,
  ) {
    const product = await this.repository.findProductById(productId);
    if (!product) throw new CatalogNotFoundError('El producto');
    if (!input.url.trim() || !input.altText.trim()) {
      throw new CatalogValidationError(
        'La imagen requiere URL y texto alternativo.',
      );
    }
    if (
      input.variantId &&
      !product.variants.some((variant) => variant.id === input.variantId)
    ) {
      throw new CatalogValidationError(
        'La imagen debe pertenecer a una variante del producto.',
      );
    }
    const media = await this.repository.createProductMedia(productId, {
      ...input,
      url: input.url.trim(),
      altText: input.altText.trim(),
    });

    this.invalidateCatalogCache();
    return this.resolveMedia(media);
  }

  public async uploadProductMedia(
    productId: string,
    input: UploadProductMediaInput,
  ) {
    const storage = this.storage;
    if (!storage) {
      throw new CatalogValidationError('Storage no está configurado.');
    }

    const contentType = input.contentType.toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new CatalogValidationError(
        'El archivo debe ser una imagen JPEG, PNG, WebP o GIF.',
      );
    }

    if (input.data.byteLength === 0) {
      throw new CatalogValidationError('La imagen no puede estar vacía.');
    }

    if (input.data.byteLength > MAX_PRODUCT_IMAGE_BYTES) {
      throw new CatalogValidationError('La imagen no puede superar los 10 MB.');
    }

    const product = await this.repository.findProductById(productId);
    if (!product) throw new CatalogNotFoundError('El producto');
    if (
      input.variantId &&
      !product.variants.some((variant) => variant.id === input.variantId)
    ) {
      throw new CatalogValidationError(
        'La variante indicada no pertenece al producto.',
      );
    }
    const variant = input.variantId
      ? product.variants.find((item) => item.id === input.variantId)
      : null;
    const altText =
      input.altText?.trim() ||
      `Imagen de ${product.name}${variant?.presentation ? ` ${variant.presentation}` : ''}`;

    const storedObject = await storage.upload({
      object: {
        bucket: PRODUCT_MEDIA_BUCKET,
        path: `products/${productId}/${randomUUID()}-${safeFileName(input.originalName)}`,
      },
      data: input.data,
      contentType,
      upsert: false,
    });

    try {
      const media = await this.repository.createProductMedia(productId, {
        variantId: input.variantId ?? null,
        url: storedObject.path,
        altText,
        displayOrder: input.displayOrder ?? 0,
      });

      this.invalidateCatalogCache();
      return this.resolveMedia(media);
    } catch (error) {
      await storage.delete(storedObject).catch(() => undefined);
      throw error;
    }
  }

  public async updateProductMedia(
    productId: string,
    mediaId: string,
    input: Partial<CreateProductMediaInput>,
  ) {
    const product = await this.ensureProduct(productId);
    const media = product.media.find((item) => item.id === mediaId);
    if (!media) throw new CatalogNotFoundError('La imagen');
    if (
      input.variantId &&
      !product.variants.some((variant) => variant.id === input.variantId)
    ) {
      throw new CatalogValidationError(
        'La imagen debe pertenecer a una variante del producto.',
      );
    }
    const next = {
      ...input,
      ...(input.altText !== undefined ? { altText: input.altText.trim() } : {}),
    };
    if (next.altText !== undefined && !next.altText) {
      throw new CatalogValidationError('El texto alternativo es obligatorio.');
    }
    const updated = await this.repository.updateProductMedia(mediaId, next);
    this.invalidateCatalogCache();
    return this.resolveMedia(updated);
  }

  public async deleteProductMedia(productId: string, mediaId: string) {
    const product = await this.ensureProduct(productId);
    const media = product.media.find((item) => item.id === mediaId);
    if (!media) throw new CatalogNotFoundError('La imagen');
    await this.repository.deleteProductMedia(mediaId);
    this.invalidateCatalogCache();
    if (this.storage && !isHttpUrl(media.url)) {
      await this.storage
        .delete({ bucket: PRODUCT_MEDIA_BUCKET, path: media.url })
        .catch(() => undefined);
    }
    return { id: mediaId, deleted: true };
  }

  public async replaceFeedingGuide(
    productId: string,
    input: ReplaceFeedingGuideInput,
  ) {
    await this.getAdminProduct(productId);
    if (!input.sourceLabel.trim() || input.entries.length === 0) {
      throw new CatalogValidationError(
        'La guía requiere fuente y al menos una entrada.',
      );
    }
    if (
      input.requiredDimensions &&
      Object.entries(input.requiredDimensions).some(
        ([key, values]) =>
          !key.trim() ||
          !Array.isArray(values) ||
          values.some((value) => typeof value !== 'string'),
      )
    ) {
      throw new CatalogValidationError(
        'Las dimensiones requeridas de la guía no son válidas.',
      );
    }
    for (const entry of input.entries) {
      if (
        entry.dailyGramsMax !== null &&
        entry.dailyGramsMax < entry.dailyGramsMin
      ) {
        throw new CatalogValidationError(
          'El máximo diario no puede ser menor al mínimo.',
        );
      }
      if (
        entry.petWeightKgMax !== null &&
        entry.petWeightKgMax < entry.petWeightKgMin
      ) {
        throw new CatalogValidationError(
          'El máximo de peso no puede ser menor al mínimo.',
        );
      }
      if (
        Object.entries(entry.conditions).some(
          ([key, value]) => !key.trim() || typeof value !== 'string',
        )
      ) {
        throw new CatalogValidationError(
          'Las condiciones de la guía no son válidas.',
        );
      }
    }
    const feedingGuide = await this.repository.replaceFeedingGuide(productId, {
      ...input,
      sourceLabel: input.sourceLabel.trim(),
      entries: input.entries.map((entry) => ({
        ...entry,
        lifeStage: entry.lifeStage?.trim() || null,
        conditions: entry.conditions ?? {},
      })),
    });
    this.invalidateCatalogCache();
    return feedingGuide;
  }

  public async setInventory(variantId: string, input: SetInventoryInput) {
    if (input.reserved > input.onHand) {
      throw new CatalogValidationError(
        'El stock reservado no puede superar el stock disponible.',
      );
    }
    const product = await this.repository.findProductByVariantId(variantId);
    if (!product) throw new CatalogNotFoundError('La variante');
    const variant = product.variants.find((item) => item.id === variantId);
    if (!variant) throw new CatalogNotFoundError('La variante');
    if (product.status === 'ACTIVE') {
      const nextVariants = product.variants.map((item) =>
        item.id === variantId
          ? {
              ...item,
              availableQuantity: Math.max(0, input.onHand - input.reserved),
            }
          : item,
      );
      assertPublishable({ ...product, variants: nextVariants });
    }
    return this.repository.setInventory(variantId, input);
  }

  public async listInventoryMovements(variantId: string) {
    const product = await this.repository.findProductByVariantId(variantId);
    if (!product) throw new CatalogNotFoundError('La variante');
    return this.repository.listInventoryMovements(variantId);
  }

  public listCategories(publicOnly = false) {
    return this.repository.listCategories(publicOnly);
  }
  public async createCategory(input: CreateReferenceInput) {
    if (!input.name.trim())
      throw new CatalogValidationError(
        'El nombre de la categoría es obligatorio.',
      );
    const categoryInput = { ...input };
    delete categoryInput.logoUrl;
    const category = await this.repository.createCategory({
      ...categoryInput,
      name: input.name.trim(),
      slug: slugify(input.slug ?? input.name),
    });
    this.invalidateCatalogCache();
    return category;
  }
  public async updateCategory(id: string, input: UpdateReferenceInput) {
    if (input.name !== undefined && !input.name.trim()) {
      throw new CatalogValidationError(
        'El nombre de la categoría es obligatorio.',
      );
    }
    const categoryInput = { ...input };
    delete categoryInput.logoUrl;
    const category = await this.repository.updateCategory(id, {
      ...categoryInput,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug ? { slug: slugify(input.slug) } : {}),
    });
    this.invalidateCatalogCache();
    return category;
  }
  public async listBrands(publicOnly = false) {
    const brands = await this.repository.listBrands(publicOnly);
    return this.resolveBrands(brands);
  }
  public async createBrand(input: CreateReferenceInput) {
    if (!input.name.trim())
      throw new CatalogValidationError('El nombre de la marca es obligatorio.');
    const brandInput = { ...input };
    delete brandInput.parentId;
    const brand = await this.repository.createBrand({
      ...brandInput,
      name: input.name.trim(),
      slug: slugify(input.slug ?? input.name),
    });
    this.invalidateCatalogCache();
    return this.resolveBrand(brand);
  }
  public async updateBrand(id: string, input: UpdateReferenceInput) {
    if (input.name !== undefined && !input.name.trim()) {
      throw new CatalogValidationError('El nombre de la marca es obligatorio.');
    }
    const brandInput = { ...input };
    delete brandInput.parentId;
    const brand = await this.repository.updateBrand(id, {
      ...brandInput,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug ? { slug: slugify(input.slug) } : {}),
    });
    this.invalidateCatalogCache();
    return this.resolveBrand(brand);
  }

  public async uploadBrandLogo(
    brandId: string,
    input: { originalName: string; contentType: string; data: Uint8Array },
  ) {
    const storage = this.storage;
    if (!storage)
      throw new CatalogValidationError('Storage no está configurado.');
    const brand = await this.repository.findBrandById(brandId);
    if (!brand) throw new CatalogNotFoundError('La marca');
    const contentType = input.contentType.toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new CatalogValidationError(
        'El logo debe ser una imagen JPEG, PNG, WebP o GIF.',
      );
    }
    if (
      input.data.byteLength === 0 ||
      input.data.byteLength > MAX_PRODUCT_IMAGE_BYTES
    ) {
      throw new CatalogValidationError(
        'El logo debe pesar entre 1 byte y 10 MB.',
      );
    }
    const storedObject = await storage.upload({
      object: {
        bucket: PRODUCT_MEDIA_BUCKET,
        path: `brands/${brandId}/${randomUUID()}-${safeFileName(input.originalName)}`,
      },
      data: input.data,
      contentType,
      upsert: false,
    });
    try {
      const updated = await this.repository.updateBrand(brandId, {
        logoUrl: storedObject.path,
      });
      if (brand.logoUrl && !isHttpUrl(brand.logoUrl)) {
        await storage
          .delete({ bucket: PRODUCT_MEDIA_BUCKET, path: brand.logoUrl })
          .catch(() => undefined);
      }
      this.invalidateCatalogCache();
      return this.resolveBrand(updated);
    } catch (error) {
      await storage.delete(storedObject).catch(() => undefined);
      throw error;
    }
  }

  private invalidateCatalogCache(
    input: CatalogCacheInvalidation = { scope: 'catalog' },
  ): void {
    if (!this.cacheInvalidation) return;
    void this.cacheInvalidation.invalidate(input).catch(() => undefined);
  }

  private async resolveProducts(products: Product[]): Promise<Product[]> {
    const fulfillment = this.fulfillment;
    const settings = fulfillment ? await fulfillment.getSettings() : undefined;
    const enriched =
      fulfillment && settings
        ? await Promise.all(
            products.map((product) =>
              fulfillment.enrichProduct(product, undefined, settings),
            ),
          )
        : products;
    return this.resolveProductMediaBatch(enriched);
  }

  private async resolveProductMedia(
    product: Product,
    settings?: Awaited<
      ReturnType<NonNullable<FulfillmentService>['getSettings']>
    >,
  ): Promise<Product> {
    const enriched =
      this.fulfillment && settings
        ? await this.fulfillment.enrichProduct(product, undefined, settings)
        : product;
    return (await this.resolveProductMediaBatch([enriched]))[0];
  }

  private resolveProductMediaBatch(products: Product[]): Promise<Product[]> {
    const storage = this.storage;
    if (!storage) return Promise.resolve(products);
    return Promise.resolve(
      products.map((product) => ({
        ...product,
        brand: {
          ...product.brand,
          logoUrl: product.brand.logoUrl
            ? resolveStorageMediaUrl(storage, product.brand.logoUrl)
            : product.brand.logoUrl,
        },
        media: product.media.map((media) => ({
          ...media,
          url: resolveStorageMediaUrl(storage, media.url),
        })),
      })),
    );
  }

  private async ensureProduct(id: string): Promise<Product> {
    const product = await this.repository.findProductById(id);
    if (!product) throw new CatalogNotFoundError('El producto');
    return product;
  }

  private resolveMedia(media: ProductMedia): Promise<ProductMedia> {
    if (!this.storage) {
      return Promise.resolve(media);
    }

    return Promise.resolve({
      ...media,
      url: resolveStorageMediaUrl(this.storage, media.url),
    });
  }

  private async resolveBrand(brand: Brand): Promise<Brand> {
    return (await this.resolveBrands([brand]))[0];
  }

  private resolveBrands(brands: Brand[]): Promise<Brand[]> {
    const storage = this.storage;
    if (!storage) return Promise.resolve(brands);
    return Promise.resolve(
      brands.map((brand) => ({
        ...brand,
        logoUrl: brand.logoUrl
          ? resolveStorageMediaUrl(storage, brand.logoUrl)
          : brand.logoUrl,
      })),
    );
  }
}

const PRODUCT_MEDIA_BUCKET = 'product-media';
const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const resolveStorageMediaUrl = (storage: StorageProvider, value: string) => {
  if (!isHttpUrl(value)) {
    return storage.getPublicUrl({ bucket: PRODUCT_MEDIA_BUCKET, path: value });
  }

  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return value;

    const objectPath = url.pathname.slice(markerIndex + marker.length);
    const bucketPrefix = `${PRODUCT_MEDIA_BUCKET}/`;
    const pathIndex = objectPath.indexOf(bucketPrefix);
    if (pathIndex === -1) return value;

    const path = decodeURIComponent(
      objectPath.slice(pathIndex + bucketPrefix.length),
    );
    return path
      ? storage.getPublicUrl({ bucket: PRODUCT_MEDIA_BUCKET, path })
      : value;
  } catch {
    return value;
  }
};

const safeFileName = (value: string): string => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'image';
};

const isSellable = (variant: {
  active: boolean;
  sku: string | null;
  salePrice: string | null;
}) => variant.active && Boolean(variant.sku) && Number(variant.salePrice) > 0;

const defaultFallbackGramsPerKg = (species: string | null): number => {
  switch (species?.toLowerCase()) {
    case 'dog':
      return 17;
    case 'cat':
      return 13;
    default:
      return 0;
  }
};

const assertPublishable = (product: {
  categoryId: string | null;
  category: { active: boolean } | null;
  brand: { active: boolean };
  variants: Array<{
    active: boolean;
    sku: string | null;
    salePrice: string | null;
  }>;
  media: Array<{ url: string }>;
}) => {
  const sellableVariants = product.variants.filter(isSellable);
  if (
    !product.categoryId ||
    !product.category?.active ||
    !product.brand.active ||
    sellableVariants.length === 0 ||
    !product.media.some((media) => media.url.trim())
  ) {
    throw new CatalogValidationError(
      'Para activar el producto se requiere categoría, imagen, variante activa con SKU y precio de venta.',
    );
  }
};

const normalizeVariant = <T extends CreateVariantInput | UpdateVariantInput>(
  input: T,
): T => ({
  ...input,
  ...(input.sku !== undefined
    ? { sku: input.sku?.trim().toUpperCase() || null }
    : {}),
  ...(input.barcode !== undefined
    ? { barcode: input.barcode?.replace(/\D/g, '') || null }
    : {}),
});

const slugify = (value: string): string => {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) throw new CatalogValidationError('El slug no puede quedar vacío.');
  return slug;
};

const importCategorySlug = (value: string): string =>
  ({
    'arena-sanitaria': 'arena-y-piedras',
    'snack-dental': 'snacks',
  })[value] ?? value;

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(concurrency, 1), items.length) },
      () => worker(),
    ),
  );
  return results;
};
