import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from '../../application/catalog.service';
import {
  FoodDurationQueryDto,
  PublicProductsQueryDto,
} from '../dto/catalog.dto';
import {
  FoodDurationResponseDto,
  PublicBrandResponseDto,
  PublicCategoryResponseDto,
  PublicProductDetailResponseDto,
  PublicProductFacetsResponseDto,
  PublicProductPageResponseDto,
  PublicCalculatorProductProjectionResponseDto,
  PublicSitemapProjectionResponseDto,
} from '../dto/public-catalog-response.dto';
import { CatalogExceptionFilter } from '../filters/catalog-exception.filter';
import { PromotionService } from '../../../promotions/application/promotion.service';
import { isWithinPeriod } from '../../../promotions/application/promotion.service';

@ApiTags('Public catalog')
@UseFilters(CatalogExceptionFilter)
@Controller()
export class PublicCatalogController {
  public constructor(
    private readonly catalog: CatalogService,
    private readonly promotions: PromotionService,
  ) {}

  @Get('products')
  @ApiOkResponse({ type: PublicProductPageResponseDto })
  @Header(
    'Cache-Control',
    'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
  )
  public async products(@Query() query: PublicProductsQueryDto) {
    const [page, promotions] = await Promise.all([
      this.catalog.listPublicProducts(query),
      this.activePromotions(),
    ]);
    return toHttpPage({
      ...page,
      items: page.items.map((product) => toPublicProduct(product, promotions)),
    });
  }

  @Get('products/facets')
  @ApiOkResponse({ type: PublicProductFacetsResponseDto })
  @Header(
    'Cache-Control',
    'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400',
  )
  public async productFacets(@Query() query: PublicProductsQueryDto) {
    const [facets, brands, categories] = await Promise.all([
      this.catalog.listPublicProductFacets(query),
      this.catalog.listBrands(true),
      this.catalog.listCategories(true),
    ]);
    return toRenderableFacets(facets, brands, categories);
  }
  @Get('products/projections/calculator')
  @ApiOkResponse({ type: [PublicCalculatorProductProjectionResponseDto] })
  @Header(
    'Cache-Control',
    'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  )
  public calculatorProjection() {
    return this.catalog.listCalculatorProjection();
  }

  @Get('products/projections/sitemap')
  @ApiOkResponse({ type: [PublicSitemapProjectionResponseDto] })
  @Header(
    'Cache-Control',
    'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  )
  public sitemapProjection() {
    return this.catalog.listSitemapProjection();
  }

  @Get('products/:slug')
  @ApiOkResponse({ type: PublicProductDetailResponseDto })
  @Header(
    'Cache-Control',
    'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
  )
  public async product(@Param('slug') slug: string) {
    const detail = await this.catalog.getPublicProductDetail(slug);
    const promotions = await this.activePromotions();
    return toPublicProductDetail(detail, promotions);
  }
  @Get('categories')
  @ApiOkResponse({ type: [PublicCategoryResponseDto] })
  @Header(
    'Cache-Control',
    'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400',
  )
  public async categories() {
    return toCategoryTree(await this.catalog.listCategories(true));
  }
  @Get('categories/:slug')
  @ApiOkResponse({ type: PublicCategoryResponseDto })
  @Header(
    'Cache-Control',
    'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400',
  )
  public async category(@Param('slug') slug: string) {
    const category = await this.catalog.getPublicCategory(slug);
    const tree = toCategoryTree(await this.catalog.listCategories(true));
    return (
      findCategoryNode(tree, slug) ?? {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
        parentId: category.parentId,
        children: [],
      }
    );
  }
  @Get('brands')
  @ApiOkResponse({ type: [PublicBrandResponseDto] })
  @Header(
    'Cache-Control',
    'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400',
  )
  public async brands() {
    const brands = await this.catalog.listBrands(true);
    return brands.map(toPublicReference);
  }
  @Get('brands/:slug')
  @ApiOkResponse({ type: PublicBrandResponseDto })
  @Header(
    'Cache-Control',
    'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400',
  )
  public brand(@Param('slug') slug: string) {
    return this.catalog.getPublicBrand(slug).then(toPublicReference);
  }

  private async activePromotions() {
    return (await this.promotions.list(true)).filter(
      (promotion) =>
        isWithinPeriod(promotion.startsAt, promotion.endsAt) &&
        (promotion.maxRedemptions === null ||
          promotion.redemptionCount < promotion.maxRedemptions),
    );
  }

  @Post('calculator/food-duration')
  @ApiOkResponse({ type: FoodDurationResponseDto })
  public foodDuration(@Body() input: FoodDurationQueryDto) {
    return this.catalog.calculateFoodDuration(input);
  }
}

const toHttpPage = <T>(page: {
  items: T[];
  page: number;
  perPage: number;
  total: number;
}) => ({
  items: page.items,
  meta: {
    page: page.page,
    perPage: page.perPage,
    total: page.total,
    totalPages: Math.ceil(page.total / page.perPage),
  },
});

const toPublicProduct = (
  product: Awaited<ReturnType<CatalogService['getPublicProduct']>>,
  promotions: Awaited<ReturnType<PromotionService['list']>> = [],
) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  description: product.description,
  line: product.line,
  species: product.species,
  lifeStage: product.lifeStage,
  breedSize: product.breedSize,
  brand: toPublicReference(product.brand),
  category: product.category ? toPublicReference(product.category) : null,
  media: product.media.map(({ url, altText, variantId }) => ({
    url,
    altText,
    variantId,
  })),
  variants: product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    presentation: variant.presentation,
    weightGrams: variant.weightGrams,
    salePrice: variant.salePrice,
    compareAtPrice: variant.compareAtPrice,
    currency: 'ARS' as const,
    fulfillment: variant.fulfillment
      ? {
          purchasable: variant.fulfillment.purchasable,
          availability: variant.fulfillment.availability,
          label: variant.fulfillment.label,
          availableQuantity: variant.fulfillment.availableQuantity,
          orderBefore: variant.fulfillment.orderBefore,
          deliveryDate: variant.fulfillment.deliveryDate,
        }
      : toFulfillment(variant),
  })),
  offers: applicablePromotions(product, promotions),
});

const toPublicProductDetail = (
  detail: Awaited<ReturnType<CatalogService['getPublicProductDetail']>>,
  promotions: Awaited<ReturnType<PromotionService['list']>>,
) => ({
  ...toPublicProduct(detail.product, promotions),
  technicalSheet: {
    species: detail.product.species,
    lifeStage: detail.product.lifeStage,
    breedSize: detail.product.breedSize,
    line: detail.product.line,
    ingredientsText: detail.product.ingredientsText,
    analyticalComposition: detail.product.analyticalComposition,
    estimatedDailyGramsPerKg: detail.product.estimatedDailyGramsPerKg,
    feedingGuide: detail.feedingGuide
      ? {
          sourceLabel: detail.feedingGuide.sourceLabel,
          sourceUrl: detail.feedingGuide.sourceUrl,
          requiredDimensions: detail.feedingGuide.requiredDimensions,
          entries: detail.feedingGuide.entries.map((entry) => ({
            ...entry,
            petWeightKg: entry.petWeightKgMin,
          })),
        }
      : null,
  },
  relatedProducts: detail.relatedProducts.map(toRelatedProduct),
});

const toRelatedProduct = (
  product: Awaited<ReturnType<CatalogService['getPublicProduct']>>,
) => {
  const prices = product.variants
    .map((variant) => Number(variant.salePrice))
    .filter((price) => Number.isFinite(price) && price > 0);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: toPublicReference(product.brand),
    category: product.category ? toPublicReference(product.category) : null,
    imageUrl: product.media[0]?.url ?? null,
    startingPrice: prices.length ? Math.min(...prices).toString() : '0.00',
  };
};

const toPublicReference = (reference: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  logoUrl?: string | null;
}) => ({
  id: reference.id,
  name: reference.name,
  slug: reference.slug,
  description: reference.description,
  seoTitle: reference.seoTitle,
  seoDescription: reference.seoDescription,
  ...(reference.logoUrl !== undefined ? { logoUrl: reference.logoUrl } : {}),
});

const applicablePromotions = (
  product: {
    id: string;
    brandId: string;
    categoryId: string | null;
    variants: Array<{ id: string }>;
  },
  promotions: Awaited<ReturnType<PromotionService['list']>>,
) =>
  promotions
    .filter(
      (promotion) =>
        !promotion.targets.length ||
        promotion.targets.some(
          (target) =>
            target.productId === product.id ||
            target.brandId === product.brandId ||
            target.categoryId === product.categoryId ||
            product.variants.some((variant) => target.variantId === variant.id),
        ),
    )
    .map((promotion) => ({
      id: promotion.id,
      name: promotion.name,
      type: promotion.type,
      value: promotion.value,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
    }));

const toFulfillment = (
  variant: Awaited<
    ReturnType<CatalogService['getPublicProduct']>
  >['variants'][number],
) => {
  if (variant.availableQuantity > 0) {
    return { status: 'IN_STOCK' as const, purchasable: true, leadTimeHours: 0 };
  }
  if (
    ['AVAILABLE', 'ON_REQUEST'].includes(variant.supplierStockStatus ?? '') &&
    variant.supplierLeadTimeHours !== null
  ) {
    return {
      status: 'ON_REQUEST' as const,
      purchasable: false,
      leadTimeHours: variant.supplierLeadTimeHours,
    };
  }
  return {
    status: 'OUT_OF_STOCK' as const,
    purchasable: false,
    leadTimeHours: null,
  };
};

const toCategoryTree = (
  categories: Awaited<ReturnType<CatalogService['listCategories']>>,
): CategoryTreeNode[] => {
  const byParent = new Map<string | null, typeof categories>();
  for (const category of categories) {
    const siblings = byParent.get(category.parentId) ?? [];
    siblings.push(category);
    byParent.set(category.parentId, siblings);
  }
  const build = (
    parentId: string | null,
    path = new Set<string>(),
  ): CategoryTreeNode[] =>
    (byParent.get(parentId) ?? []).flatMap((category) => {
      if (path.has(category.id)) return [];
      const nextPath = new Set(path).add(category.id);
      return [
        {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          seoTitle: category.seoTitle,
          seoDescription: category.seoDescription,
          parentId: category.parentId,
          children: build(category.id, nextPath),
        },
      ];
    });
  return build(null);
};

const toRenderableFacets = (
  facets: Awaited<ReturnType<CatalogService['listPublicProductFacets']>>,
  brands: Awaited<ReturnType<CatalogService['listBrands']>>,
  categories: Awaited<ReturnType<CatalogService['listCategories']>>,
) => {
  const brandCounts = new Map(
    facets.brands.map((option) => [option.value, option.count]),
  );
  const categoryData = new Map(
    facets.categories.map((option) => [option.value, option]),
  );
  const categoryTree = toCategoryTree(categories);
  const decorateCategory = (category: CategoryTreeNode): CategoryFacetNode => {
    const children = category.children.map(decorateCategory);
    const own = categoryData.get(category.slug);
    return {
      ...category,
      value: category.slug,
      label: category.name,
      count:
        (own?.count ?? 0) + children.reduce((sum, item) => sum + item.count, 0),
      species: Array.from(
        new Set([
          ...(own?.species ?? []),
          ...children.flatMap((item) => item.species),
        ]),
      ).sort(),
      children,
    };
  };
  const lifeStageCounts = new Map(
    facets.lifeStages.map((option) => [option.value, option.count]),
  );
  const weightCounts = new Map(
    facets.weights.map((option) => [option.value, option.count]),
  );
  const brandOptions = brands.map((brand) => ({
    value: brand.slug,
    label: brand.name,
    count: brandCounts.get(brand.slug) ?? 0,
    logoUrl: brand.logoUrl,
  }));
  const categoryOptions = categoryTree.map(decorateCategory);
  return {
    brands: brandOptions.filter((option) => option.count > 0),
    categories: categoryOptions.filter((option) => option.count > 0),
    lifeStages: Array.from(lifeStageCounts.entries())
      .map(([value, count]) => ({ value, label: facetLabel(value), count }))
      .filter((option) => option.count > 0)
      .sort((left, right) => left.label.localeCompare(right.label)),
    weights: Array.from(weightCounts.entries())
      .map(([value, count]) => ({
        value,
        label: value >= 1000 ? `${value / 1000} kg` : `${value} g`,
        count,
      }))
      .filter((option) => option.count > 0)
      .sort((left, right) => left.value - right.value),
  };
};

const facetLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());

const findCategoryNode = (nodes: CategoryTreeNode[], slug: string): unknown => {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const child = findCategoryNode(node.children, slug);
    if (child) return child;
  }
  return null;
};

interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  parentId: string | null;
  children: CategoryTreeNode[];
}

interface CategoryFacetNode extends Omit<CategoryTreeNode, 'children'> {
  value: string;
  label: string;
  count: number;
  species: string[];
  children: CategoryFacetNode[];
}
