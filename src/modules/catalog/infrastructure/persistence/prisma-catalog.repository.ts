import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { Prisma } from '../../../../infrastructure/database/generated/prisma/client';
import {
  CatalogConflictError,
  CatalogNotFoundError,
  CatalogValidationError,
} from '../../domain/errors/catalog.error';
import type {
  AdminProductFilter,
  Brand,
  Category,
  CursorPage,
  CreateProductInput,
  CreateProductMediaInput,
  CreateReferenceInput,
  CreateVariantInput,
  FeedingGuide,
  InventoryItem,
  InventoryMovement,
  Page,
  Product,
  ProductMedia,
  ProductVariant,
  MobileProductFilter,
  PublicProductFilter,
  ReplaceFeedingGuideInput,
  SetInventoryInput,
  SupplierStockStatus,
  UpdateProductInput,
  UpdateReferenceInput,
  UpdateVariantInput,
  CompetitivePriceObservation,
} from '../../domain/catalog.types';
import type { CatalogRepository } from '../../domain/repositories/catalog.repository';

interface DecimalValue {
  toString(): string;
}
interface PersistenceCategory {
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
interface PersistenceBrand {
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
interface PersistenceVariant {
  id: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
  presentation: string | null;
  weightGrams: number | null;
  salePrice: DecimalValue | null;
  compareAtPrice: DecimalValue | null;
  active: boolean;
  preferredSupplierOfferId: string | null;
  revision: number;
  inventory: { onHand: number; reserved: number } | null;
  preferredSupplierOffer: {
    stockStatus: string;
    leadTimeHours: number | null;
    active: boolean;
  } | null;
}
interface PersistenceMedia {
  id: string;
  url: string;
  altText: string;
  displayOrder: number;
  variantId: string | null;
}
interface PersistenceInventory {
  variantId: string;
  onHand: number;
  reserved: number;
}
interface PersistenceProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ingredientsText: string | null;
  analyticalComposition: unknown;
  brandId: string;
  categoryId: string | null;
  species: string | null;
  line: string | null;
  lifeStage: string | null;
  breedSize: string | null;
  estimatedDailyGramsPerKg: DecimalValue | null;
  featuredRank: number | null;
  status: string;
  brand: PersistenceBrand;
  category: PersistenceCategory | null;
  variants: PersistenceVariant[];
  media: PersistenceMedia[];
}

const productInclude = {
  brand: true,
  category: true,
  variants: { include: { inventory: true, preferredSupplierOffer: true } },
  media: { orderBy: { displayOrder: 'asc' as const } },
} as const;

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async listPublicProducts(
    filter: PublicProductFilter,
  ): Promise<Page<Product>> {
    const brands = filter.brand ? toArray(filter.brand) : undefined;
    const lifeStages = filter.lifeStage ? toArray(filter.lifeStage) : undefined;
    const weights = filter.weightGrams
      ? toArray(filter.weightGrams)
      : undefined;
    const categoryIds = filter.category
      ? await this.resolveCategoryIds(filter.category)
      : undefined;
    const priceCondition = {
      active: true,
      sku: { not: null },
      salePrice: {
        gt: 0,
        ...(filter.minPrice ? { gte: filter.minPrice } : {}),
        ...(filter.maxPrice ? { lte: filter.maxPrice } : {}),
      },
      ...(weights ? { weightGrams: { in: weights } } : {}),
    };
    const where = {
      status: 'ACTIVE' as const,
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: 'insensitive' as const } },
              { line: { contains: filter.q, mode: 'insensitive' as const } },
              {
                brand: {
                  name: { contains: filter.q, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
      ...(filter.species
        ? {
            AND: [
              {
                OR: speciesAliases(filter.species).map((species) => ({
                  species: { equals: species, mode: 'insensitive' as const },
                })),
              },
            ],
          }
        : {}),
      ...(lifeStages ? { lifeStage: { in: lifeStages } } : {}),
      ...(filter.featured ? { featuredRank: { not: null } } : {}),
      brand: { active: true, ...(brands ? { slug: { in: brands } } : {}) },
      category: {
        is: {
          active: true,
          ...(categoryIds ? { id: { in: categoryIds } } : {}),
        },
      },
      variants: { some: priceCondition },
    };
    const isPriceSort =
      filter.sort === 'price_asc' || filter.sort === 'price_desc';
    const [records, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        ...(isPriceSort
          ? {}
          : {
              orderBy:
                filter.sort === 'name_asc'
                  ? [{ name: 'asc' as const }]
                  : [
                      { featuredRank: 'asc' as const },
                      { name: 'asc' as const },
                    ],
              skip: (filter.page - 1) * filter.perPage,
              take: filter.perPage,
            }),
      }),
      this.prisma.product.count({ where }),
    ]);
    const variantFilter = {
      weights,
      minPrice: filter.minPrice ? Number(filter.minPrice) : undefined,
      maxPrice: filter.maxPrice ? Number(filter.maxPrice) : undefined,
    };
    const products = records
      .map(mapProduct)
      .map((product) => onlySellableVariants(product, variantFilter));
    if (isPriceSort)
      products.sort((left, right) => compareProducts(left, right, filter.sort));
    return isPriceSort
      ? {
          items: products.slice(
            (filter.page - 1) * filter.perPage,
            filter.page * filter.perPage,
          ),
          page: filter.page,
          perPage: filter.perPage,
          total,
        }
      : { items: products, page: filter.page, perPage: filter.perPage, total };
  }

  public async findPublicProductBySlug(slug: string): Promise<Product | null> {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: 'ACTIVE',
        brand: { active: true },
        category: { is: { active: true } },
        variants: {
          some: { active: true, sku: { not: null }, salePrice: { gt: 0 } },
        },
      },
      include: productInclude,
    });
    return product ? onlySellableVariants(mapProduct(product)) : null;
  }

  public async listMobileProducts(
    filter: MobileProductFilter,
  ): Promise<CursorPage<Product>> {
    const categoryIds = filter.category
      ? await this.resolveCategoryIds(filter.category)
      : undefined;
    const query = filter.query?.trim();
    const priceCondition = {
      active: true,
      sku: { not: null },
      salePrice: { gt: 0 },
    };
    const purchasedCondition = filter.purchasedVariantIds
      ? { id: { in: filter.purchasedVariantIds } }
      : {};
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' as const } },
              { line: { contains: query, mode: 'insensitive' as const } },
              {
                brand: {
                  name: { contains: query, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
      ...(filter.species
        ? {
            species: {
              in: filter.species === 'dog' ? ['dog', 'perro'] : ['cat', 'gato'],
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(filter.featured ? { featuredRank: { not: null } } : {}),
      brand: { active: true, ...(filter.brand ? { slug: filter.brand } : {}) },
      category: {
        is: {
          active: true,
          ...(categoryIds ? { id: { in: categoryIds } } : {}),
        },
      },
      variants: {
        some: {
          ...priceCondition,
          ...purchasedCondition,
        },
      },
    };
    const offset = decodeMobileCursor(filter.cursor);
    const records = await this.prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ featuredRank: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: filter.limit + 1,
    });
    const hasNext = records.length > filter.limit;
    return {
      items: records
        .slice(0, filter.limit)
        .map(mapProduct)
        .map((product) => onlySellableVariants(product)),
      nextCursor: hasNext ? encodeMobileCursor(offset + filter.limit) : null,
    };
  }

  public async listPurchasedVariantIds(customerId: string): Promise<string[]> {
    const lines = await this.prisma.orderLine.findMany({
      where: {
        order: {
          customerId,
          status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        },
      },
      select: { variantId: true },
      distinct: ['variantId'],
    });
    return lines.map((line) => line.variantId);
  }

  public async listRelatedPublicProducts(
    product: Product,
    limit: number,
  ): Promise<Product[]> {
    const relationOr = [
      ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
      ...(product.species && product.lifeStage
        ? [{ species: product.species, lifeStage: product.lifeStage }]
        : product.species
          ? [{ species: product.species }]
          : []),
      { brandId: product.brandId },
    ];
    const candidates = await this.prisma.product.findMany({
      where: {
        ...sellableProductWhere,
        id: { not: product.id },
        OR: relationOr,
      },
      include: productInclude,
      orderBy: [{ featuredRank: 'asc' }, { name: 'asc' }],
      take: Math.max(limit * 3, limit),
    });

    return candidates
      .map(mapProduct)
      .map((candidate) => onlySellableVariants(candidate))
      .sort(
        (left, right) =>
          relatedScore(right, product) - relatedScore(left, product),
      )
      .slice(0, limit);
  }

  public async findPublicCategoryBySlug(
    slug: string,
  ): Promise<Category | null> {
    const categories = await this.listCategories(true);
    return categories.find((category) => category.slug === slug) ?? null;
  }

  public async findPublicBrandBySlug(slug: string): Promise<Brand | null> {
    const brand = await this.prisma.brand.findFirst({
      where: { slug, active: true, products: { some: sellableProductWhere } },
    });
    return brand ? mapBrand(brand) : null;
  }

  public async findActiveFeedingGuide(
    productId: string,
  ): Promise<FeedingGuide | null> {
    const guide = await this.prisma.feedingGuide.findFirst({
      where: { productId, active: true },
      include: { entries: { orderBy: { petWeightKgMin: 'asc' } } },
      orderBy: { version: 'desc' },
    });
    if (!guide) return null;
    return {
      id: guide.id,
      productId: guide.productId,
      sourceLabel: guide.sourceLabel,
      sourceUrl: guide.sourceUrl,
      requiredDimensions: asStringArrayRecord(guide.requiredDimensions),
      entries: guide.entries.map((entry) => ({
        petWeightKgMin: Number(entry.petWeightKgMin),
        petWeightKgMax:
          entry.petWeightKgMax === null ? null : Number(entry.petWeightKgMax),
        lifeStage: entry.lifeStage,
        conditions: asStringRecord(entry.conditions),
        dailyGramsMin: Number(entry.dailyGramsMin),
        dailyGramsMax:
          entry.dailyGramsMax === null ? null : Number(entry.dailyGramsMax),
      })),
    };
  }

  public async listAdminProducts(
    filter: AdminProductFilter,
  ): Promise<Page<Product>> {
    const where: Prisma.ProductWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.brandId ? { brandId: filter.brandId } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.species ? { species: filter.species } : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: 'insensitive' } },
              { slug: { contains: filter.q, mode: 'insensitive' } },
              { brand: { name: { contains: filter.q, mode: 'insensitive' } } },
              {
                variants: {
                  some: { sku: { contains: filter.q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
      ...(filter.hasStock === undefined
        ? {}
        : filter.hasStock
          ? { variants: { some: { inventory: { is: { onHand: { gt: 0 } } } } } }
          : {
              variants: { none: { inventory: { is: { onHand: { gt: 0 } } } } },
            }),
    };
    const orderBy =
      filter.sort === 'name_desc'
        ? { name: 'desc' as const }
        : filter.sort === 'updated_desc'
          ? { updatedAt: 'desc' as const }
          : { name: 'asc' as const };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.prisma.product.count({
        where,
      }),
    ]);
    return {
      items: records.map(mapProduct),
      page: filter.page,
      perPage: filter.perPage,
      total,
    };
  }

  public async listAllAdminProducts(): Promise<Product[]> {
    const records = await this.prisma.product.findMany({
      include: productInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return records.map(mapProduct);
  }

  public async findExistingCatalogImportKeys(
    slugs: string[],
    skus: string[],
  ): Promise<{ slugs: string[]; skus: string[] }> {
    const [products, variants] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true },
      }),
      this.prisma.productVariant.findMany({
        where: { sku: { in: skus } },
        select: { sku: true },
      }),
    ]);
    return {
      slugs: products.map((product) => product.slug),
      skus: variants.flatMap((variant) =>
        variant.sku === null ? [] : [variant.sku],
      ),
    };
  }

  public async findProductById(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    return product ? mapProduct(product) : null;
  }

  public async findProductBySlug(slug: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: productInclude,
    });
    return product ? mapProduct(product) : null;
  }

  public async findProductByVariantId(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findFirst({
      where: { variants: { some: { id } } },
      include: productInclude,
    });
    return product ? mapProduct(product) : null;
  }

  public async findCategoryById(id: string): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    return category ? mapCategory(category) : null;
  }

  public async findBrandById(id: string): Promise<Brand | null> {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    return brand ? mapBrand(brand) : null;
  }

  public async findSupplierOfferFulfillment(
    variantId: string,
    offerId: string,
  ): Promise<{
    stockStatus: SupplierStockStatus;
    leadTimeHours: number | null;
  } | null> {
    const offer = await this.prisma.supplierOffer.findUnique({
      where: { id: offerId },
      select: {
        variantId: true,
        stockStatus: true,
        leadTimeHours: true,
        active: true,
      },
    });
    if (!offer || offer.variantId !== variantId || !offer.active) return null;
    return {
      stockStatus: offer.stockStatus,
      leadTimeHours: offer.leadTimeHours,
    };
  }

  public async createProduct(
    input: CreateProductInput & { slug: string },
  ): Promise<Product> {
    return this.write(async () =>
      mapProduct(
        await this.prisma.product.create({
          data: {
            id: randomUUID(),
            ...input,
            analyticalComposition:
              input.analyticalComposition === null
                ? Prisma.JsonNull
                : input.analyticalComposition,
            status: 'DRAFT',
          } as never,
          include: productInclude,
        }),
      ),
    );
  }

  public async updateProduct(
    id: string,
    input: UpdateProductInput,
  ): Promise<Product> {
    return this.write(async () =>
      mapProduct(
        await this.prisma.product.update({
          where: { id },
          data: {
            ...input,
            analyticalComposition:
              input.analyticalComposition === null
                ? Prisma.JsonNull
                : input.analyticalComposition,
          } as never,
          include: productInclude,
        }),
      ),
    );
  }

  public async createVariant(
    productId: string,
    input: CreateVariantInput,
  ): Promise<ProductVariant> {
    return this.write(async () =>
      mapVariant(
        await this.prisma.productVariant.create({
          data: { id: randomUUID(), ...input, productId },
          include: { inventory: true, preferredSupplierOffer: true },
        }),
      ),
    );
  }

  public async updateVariant(
    id: string,
    input: UpdateVariantInput,
  ): Promise<ProductVariant> {
    if (input.preferredSupplierOfferId) {
      const offer = await this.prisma.supplierOffer.findUnique({
        where: { id: input.preferredSupplierOfferId },
        select: { variantId: true },
      });
      if (!offer || offer.variantId !== id) {
        throw new CatalogValidationError(
          'La oferta preferida debe pertenecer a la variante.',
        );
      }
    }
    return this.write(async () =>
      mapVariant(
        await this.prisma.productVariant.update({
          where: { id },
          data: { ...input, revision: { increment: 1 } },
          include: { inventory: true, preferredSupplierOffer: true },
        }),
      ),
    );
  }

  public async createProductMedia(
    productId: string,
    input: CreateProductMediaInput,
  ): Promise<ProductMedia> {
    return this.write(async () => {
      const media = await this.prisma.productMedia.create({
        data: {
          id: randomUUID(),
          productId,
          variantId: input.variantId ?? null,
          url: input.url,
          altText: input.altText,
          displayOrder: input.displayOrder ?? 0,
        },
      });
      return mapMedia(media);
    });
  }

  public async updateProductMedia(
    id: string,
    input: Partial<CreateProductMediaInput>,
  ): Promise<ProductMedia> {
    return this.write(async () =>
      mapMedia(
        await this.prisma.productMedia.update({
          where: { id },
          data: input,
        }),
      ),
    );
  }

  public async deleteProductMedia(id: string): Promise<void> {
    await this.write(() =>
      this.prisma.productMedia.delete({ where: { id } }).then(() => undefined),
    );
  }

  public async replaceFeedingGuide(
    productId: string,
    input: ReplaceFeedingGuideInput,
  ): Promise<FeedingGuide> {
    return this.write(() =>
      this.prisma.$transaction(async (transaction) => {
        const latest = await transaction.feedingGuide.findFirst({
          where: { productId },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        await transaction.feedingGuide.updateMany({
          where: { productId, active: true },
          data: { active: false },
        });
        const guide = await transaction.feedingGuide.create({
          data: {
            productId,
            sourceLabel: input.sourceLabel,
            sourceUrl: input.sourceUrl ?? null,
            version: (latest?.version ?? 0) + 1,
            requiredDimensions: input.requiredDimensions ?? {},
            entries: {
              create: input.entries.map((entry) => ({
                petWeightKgMin: entry.petWeightKgMin,
                petWeightKgMax: entry.petWeightKgMax,
                lifeStage: entry.lifeStage ?? null,
                conditions: entry.conditions,
                dailyGramsMin: entry.dailyGramsMin,
                dailyGramsMax: entry.dailyGramsMax,
              })),
            },
          },
          include: { entries: { orderBy: { petWeightKgMin: 'asc' } } },
        });
        return mapFeedingGuide(guide);
      }),
    );
  }

  public async setInventory(
    variantId: string,
    input: SetInventoryInput,
  ): Promise<InventoryItem> {
    return this.write(() =>
      this.prisma.$transaction(async (transaction) => {
        const current = await transaction.inventoryItem.findUnique({
          where: { variantId },
        });
        const inventory = await transaction.inventoryItem.upsert({
          where: { variantId },
          create: { variantId, onHand: input.onHand, reserved: input.reserved },
          update: { onHand: input.onHand, reserved: input.reserved },
        });
        const delta = input.onHand - (current?.onHand ?? 0);
        if (delta !== 0) {
          await transaction.inventoryMovement.create({
            data: {
              variantId,
              type: 'ADJUSTMENT',
              quantity: Math.abs(delta),
              reason: input.reason?.trim() || 'Ajuste manual de inventario',
            },
          });
        }
        return mapInventory(inventory);
      }),
    );
  }

  public async listInventoryMovements(
    variantId: string,
  ): Promise<InventoryMovement[]> {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
    });
    return movements.map((movement) => ({
      id: movement.id,
      variantId: movement.variantId,
      orderId: movement.orderId,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      createdAt: movement.createdAt,
    }));
  }

  public async listCompetitivePriceObservations(
    variantId: string,
  ): Promise<CompetitivePriceObservation[]> {
    const observations = await this.prisma.retailPriceObservation.findMany({
      where: { variantId },
      orderBy: { observedAt: 'desc' },
    });
    return observations.map((observation) => ({
      retailerCode: observation.retailerCode,
      price: observation.price?.toString() ?? null,
      currency: observation.currency,
      availability: observation.availability,
      matchStatus: observation.matchStatus,
      observedAt: observation.observedAt,
      sourceUrl: observation.sourceUrl,
    }));
  }

  public async listCategories(publicOnly: boolean): Promise<Category[]> {
    const records = await this.prisma.category.findMany({
      where: publicOnly ? { active: true } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    const categories = records.map(mapCategory);
    if (!publicOnly) return categories;

    const products = await this.prisma.product.findMany({
      where: sellableProductWhere,
      select: { categoryId: true },
    });
    const byId = new Map(categories.map((category) => [category.id, category]));
    const visible = new Set<string>();
    for (const product of products) {
      let categoryId = product.categoryId;
      const visited = new Set<string>();
      while (categoryId && !visited.has(categoryId)) {
        visited.add(categoryId);
        const category = byId.get(categoryId);
        if (!category) break;
        visible.add(category.id);
        categoryId = category.parentId;
      }
    }
    return categories.filter((category) => visible.has(category.id));
  }
  public createCategory(
    input: CreateReferenceInput & { slug: string },
  ): Promise<Category> {
    return this.write(async () =>
      mapCategory(await this.prisma.category.create({ data: input })),
    );
  }
  public updateCategory(
    id: string,
    input: UpdateReferenceInput,
  ): Promise<Category> {
    return this.write(async () => {
      if (input.active === false) {
        const activeProducts = await this.prisma.product.count({
          where: { categoryId: id, status: 'ACTIVE' },
        });
        if (activeProducts > 0) {
          throw new CatalogValidationError(
            'No se puede desactivar una categoría con productos publicados.',
          );
        }
      }
      return mapCategory(
        await this.prisma.category.update({ where: { id }, data: input }),
      );
    });
  }
  public async listBrands(publicOnly: boolean): Promise<Brand[]> {
    const brands = await this.prisma.brand.findMany({
      where: publicOnly
        ? {
            active: true,
            products: { some: sellableProductWhere },
          }
        : undefined,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return brands.map(mapBrand);
  }
  public createBrand(
    input: CreateReferenceInput & { slug: string },
  ): Promise<Brand> {
    return this.write(async () =>
      mapBrand(await this.prisma.brand.create({ data: input })),
    );
  }
  public updateBrand(id: string, input: UpdateReferenceInput): Promise<Brand> {
    return this.write(async () => {
      if (input.active === false) {
        const activeProducts = await this.prisma.product.count({
          where: { brandId: id, status: 'ACTIVE' },
        });
        if (activeProducts > 0) {
          throw new CatalogValidationError(
            'No se puede desactivar una marca con productos publicados.',
          );
        }
      }
      return mapBrand(
        await this.prisma.brand.update({ where: { id }, data: input }),
      );
    });
  }

  private async resolveCategoryIds(slug: string): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      where: { active: true },
      select: { id: true, slug: true, parentId: true },
    });
    const category = categories.find((item) => item.slug === slug);
    if (!category) return [];
    const descendants = new Set([category.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of categories) {
        if (
          candidate.parentId &&
          descendants.has(candidate.parentId) &&
          !descendants.has(candidate.id)
        ) {
          descendants.add(candidate.id);
          changed = true;
        }
      }
    }
    return [...descendants];
  }

  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new CatalogConflictError(
          'Ya existe un registro con ese slug o SKU.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new CatalogValidationError('La relación referenciada no existe.');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new CatalogNotFoundError('El registro');
      }
      throw error;
    }
  }
}

const mapCategory = (value: PersistenceCategory): Category => ({
  id: value.id,
  name: value.name,
  slug: value.slug,
  description: value.description,
  seoTitle: value.seoTitle,
  seoDescription: value.seoDescription,
  displayOrder: value.displayOrder,
  parentId: value.parentId,
  active: value.active,
});
const mapBrand = (value: PersistenceBrand): Brand => ({
  id: value.id,
  name: value.name,
  slug: value.slug,
  description: value.description,
  seoTitle: value.seoTitle,
  seoDescription: value.seoDescription,
  logoUrl: value.logoUrl,
  displayOrder: value.displayOrder,
  active: value.active,
});
const mapVariant = (value: PersistenceVariant): ProductVariant => ({
  id: value.id,
  productId: value.productId,
  sku: value.sku,
  barcode: value.barcode,
  presentation: value.presentation,
  weightGrams: value.weightGrams,
  active: value.active,
  preferredSupplierOfferId: value.preferredSupplierOfferId,
  revision: value.revision,
  salePrice: value.salePrice?.toString() ?? null,
  compareAtPrice: value.compareAtPrice?.toString() ?? null,
  availableQuantity: Math.max(
    0,
    (value.inventory?.onHand ?? 0) - (value.inventory?.reserved ?? 0),
  ),
  supplierStockStatus: (value.preferredSupplierOffer?.active
    ? value.preferredSupplierOffer.stockStatus
    : null) as ProductVariant['supplierStockStatus'],
  supplierLeadTimeHours: value.preferredSupplierOffer?.active
    ? value.preferredSupplierOffer.leadTimeHours
    : null,
  onHand: value.inventory?.onHand ?? 0,
  reserved: value.inventory?.reserved ?? 0,
});
const mapProduct = (value: PersistenceProduct): Product => ({
  id: value.id,
  name: value.name,
  slug: value.slug,
  description: value.description,
  ingredientsText: value.ingredientsText,
  analyticalComposition: asObjectRecord(value.analyticalComposition),
  brandId: value.brandId,
  categoryId: value.categoryId,
  species: value.species,
  line: value.line,
  lifeStage: value.lifeStage,
  breedSize: value.breedSize,
  estimatedDailyGramsPerKg: value.estimatedDailyGramsPerKg?.toString() ?? null,
  featuredRank: value.featuredRank,
  status: value.status as Product['status'],
  brand: mapBrand(value.brand),
  category: value.category ? mapCategory(value.category) : null,
  variants: value.variants.map(mapVariant),
  media: value.media.map(mapMedia),
});

const speciesAliases = (value: string): string[] => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'cat' || normalized === 'gato') return ['cat', 'gato'];
  if (normalized === 'dog' || normalized === 'perro') {
    return ['dog', 'perro'];
  }
  return [normalized];
};

const onlySellableVariants = (
  product: Product,
  filter?: {
    weights?: number[];
    minPrice?: number;
    maxPrice?: number;
  },
): Product => {
  const variants = product.variants.filter((variant) => {
    const price = Number(variant.salePrice);
    return (
      variant.active &&
      Boolean(variant.sku) &&
      price > 0 &&
      (!filter?.weights || filter.weights.includes(variant.weightGrams ?? 0)) &&
      (filter?.minPrice === undefined || price >= filter.minPrice) &&
      (filter?.maxPrice === undefined || price <= filter.maxPrice)
    );
  });
  const visibleVariantIds = new Set(variants.map((variant) => variant.id));
  return {
    ...product,
    variants,
    media: product.media.filter(
      (media) => !media.variantId || visibleVariantIds.has(media.variantId),
    ),
  };
};
const minimumPrice = (product: Product) =>
  Math.min(...product.variants.map((variant) => Number(variant.salePrice)));
const compareProducts = (left: Product, right: Product, sort = 'featured') => {
  if (sort === 'price_asc') return minimumPrice(left) - minimumPrice(right);
  if (sort === 'price_desc') return minimumPrice(right) - minimumPrice(left);
  if (sort === 'featured') {
    return (
      (left.featuredRank ?? Number.MAX_SAFE_INTEGER) -
        (right.featuredRank ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name)
    );
  }
  return left.name.localeCompare(right.name);
};
const relatedScore = (candidate: Product, product: Product): number =>
  (candidate.categoryId && candidate.categoryId === product.categoryId
    ? 4
    : 0) +
  (candidate.species && candidate.species === product.species ? 2 : 0) +
  (candidate.lifeStage && candidate.lifeStage === product.lifeStage ? 2 : 0) +
  (candidate.brandId === product.brandId ? 1 : 0);
const toArray = <T>(value: T | T[]): T[] =>
  Array.isArray(value) ? value : [value];
const sellableProductWhere = {
  status: 'ACTIVE' as const,
  brand: { active: true },
  category: { is: { active: true } },
  variants: {
    some: { active: true, sku: { not: null }, salePrice: { gt: 0 } },
  },
};
const asStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};
const asStringArrayRecord = (value: unknown): Record<string, string[]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) &&
        entry[1].every((item) => typeof item === 'string'),
    ),
  );
};

const asObjectRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const encodeMobileCursor = (offset: number): string =>
  Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');

const decodeMobileCursor = (cursor?: string): number => {
  if (!cursor) return 0;
  try {
    const value = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { offset?: unknown };
    return Number.isInteger(value.offset) && Number(value.offset) >= 0
      ? Number(value.offset)
      : 0;
  } catch {
    return 0;
  }
};

const mapMedia = (media: {
  id: string;
  url: string;
  altText: string;
  displayOrder: number;
  variantId: string | null;
}): ProductMedia => ({
  id: media.id,
  url: media.url,
  altText: media.altText,
  displayOrder: media.displayOrder,
  variantId: media.variantId,
});

const mapFeedingGuide = (guide: {
  id: string;
  productId: string;
  sourceLabel: string;
  sourceUrl: string | null;
  requiredDimensions: unknown;
  entries: Array<{
    petWeightKgMin: unknown;
    petWeightKgMax: unknown;
    lifeStage: string | null;
    conditions: unknown;
    dailyGramsMin: unknown;
    dailyGramsMax: unknown;
  }>;
}): FeedingGuide => ({
  id: guide.id,
  productId: guide.productId,
  sourceLabel: guide.sourceLabel,
  sourceUrl: guide.sourceUrl,
  requiredDimensions: asStringArrayRecord(guide.requiredDimensions),
  entries: guide.entries.map((entry) => ({
    petWeightKgMin: Number(entry.petWeightKgMin),
    petWeightKgMax:
      entry.petWeightKgMax === null ? null : Number(entry.petWeightKgMax),
    lifeStage: entry.lifeStage,
    conditions: asStringRecord(entry.conditions),
    dailyGramsMin: Number(entry.dailyGramsMin),
    dailyGramsMax:
      entry.dailyGramsMax === null ? null : Number(entry.dailyGramsMax),
  })),
});

const mapInventory = (inventory: PersistenceInventory): InventoryItem => ({
  variantId: inventory.variantId,
  onHand: inventory.onHand,
  reserved: inventory.reserved,
  available: Math.max(0, inventory.onHand - inventory.reserved),
});
