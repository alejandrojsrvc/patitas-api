import { CustomerNotFoundError } from '../../customers/domain/customer.error';
import type { CustomerService } from '../../customers/application/customer.service';
import { isWithinPeriod } from '../../promotions/application/promotion.service';
import type { PromotionService } from '../../promotions/application/promotion.service';
import type { ShippingService } from '../../shipping/application/shipping.service';
import type {
  CursorPage,
  MobileProductFilter,
  Product,
} from '../domain/catalog.types';
import type { CatalogRepository } from '../domain/repositories/catalog.repository';
import { CatalogValidationError } from '../domain/errors/catalog.error';
import type { ShippingQuote } from '../../shipping/domain/shipping.types';

export interface MobileCatalogInput {
  query?: string;
  q?: string;
  category?: string;
  species?: 'dog' | 'cat';
  brand?: string;
  featured?: boolean;
  previouslyPurchased?: boolean;
  postalCode?: string;
  cursor?: string;
  limit: number;
}

export interface MobileProductView {
  product: Product;
  shippingQuotes: Map<string, ShippingQuote>;
}

export class MobileCatalogService {
  public constructor(
    private readonly repository: CatalogRepository,
    private readonly catalog: import('./catalog.service').CatalogService,
    private readonly promotions: PromotionService,
    private readonly shipping: ShippingService,
    private readonly customers: CustomerService,
  ) {}

  public async listCategories(input: { cursor?: string; limit: number }) {
    const categories = await this.catalog.listCategories(true);
    return paginate(categories, input.cursor, input.limit);
  }

  public async listProducts(input: MobileCatalogInput, userId?: string) {
    const customerId = await this.customerIdFor(
      input.previouslyPurchased,
      userId,
    );
    if (input.previouslyPurchased && !customerId) {
      return { items: [], nextCursor: null };
    }
    const page = await this.repository.listMobileProducts({
      query: input.query ?? input.q,
      category: input.category,
      species: input.species,
      brand: input.brand,
      featured: input.featured,
      purchasedVariantIds: input.previouslyPurchased
        ? await this.repository.listPurchasedVariantIds(customerId as string)
        : undefined,
      cursor: input.cursor,
      limit: input.limit,
    });
    return {
      items: await this.prepareProducts(page.items, input.postalCode),
      nextCursor: page.nextCursor,
    };
  }

  public async getProduct(slug: string, input: MobileCatalogInput) {
    const product = await this.catalog.getPublicProduct(slug);
    const products = await this.prepareProducts([product], input.postalCode);
    return products[0];
  }

  public async listOffers(input: MobileCatalogInput, userId?: string) {
    const hasProductFilter = Boolean(
      input.query ??
      input.q ??
      input.category ??
      input.species ??
      input.brand ??
      input.featured ??
      input.previouslyPurchased ??
      input.postalCode,
    );
    let products: Product[] | undefined;
    if (hasProductFilter) {
      const customerId = await this.customerIdFor(
        input.previouslyPurchased,
        userId,
      );
      if (input.previouslyPurchased && !customerId) {
        return { items: [], nextCursor: null };
      }
      products = await this.listMatchingProducts(input, customerId);
    }

    const promotions = (await this.promotions.list(true)).filter(
      (promotion) =>
        isWithinPeriod(promotion.startsAt, promotion.endsAt) &&
        (promotion.maxRedemptions === null ||
          promotion.redemptionCount < promotion.maxRedemptions) &&
        (!products ||
          products.some((product) => appliesTo(product, promotion))),
    );
    return paginate(promotions, input.cursor, input.limit);
  }

  private async listMatchingProducts(
    input: MobileCatalogInput,
    customerId: string | null,
  ) {
    const filter: MobileProductFilter = {
      query: input.query ?? input.q,
      category: input.category,
      species: input.species,
      brand: input.brand,
      featured: input.featured,
      purchasedVariantIds: input.previouslyPurchased
        ? await this.repository.listPurchasedVariantIds(customerId as string)
        : undefined,
      limit: 100,
    };
    const page = await this.repository.listMobileProducts(filter);
    return page.items;
  }

  private async prepareProducts(
    products: Product[],
    postalCode?: string,
  ): Promise<MobileProductView[]> {
    return Promise.all(
      products.map(async (product) => {
        const resolved = await this.catalog.resolvePublicProduct(product);
        const shippingQuotes = new Map<
          string,
          Awaited<ReturnType<ShippingService['quote']>>
        >();
        if (postalCode) {
          await Promise.all(
            resolved.variants.map(async (variant) => {
              const quote = await this.shipping.quote({
                postalCode,
                subtotal: variant.salePrice ?? '0.00',
                weightGrams: variant.weightGrams ?? 0,
                stockAvailable: true,
              });
              shippingQuotes.set(variant.id, quote);
            }),
          );
        }
        return { product: resolved, shippingQuotes };
      }),
    );
  }

  private async customerIdFor(
    previouslyPurchased: boolean | undefined,
    userId: string | undefined,
  ): Promise<string | null> {
    if (!previouslyPurchased) return null;
    if (!userId) return null;
    try {
      return (await this.customers.findByUserId(userId)).id;
    } catch (error) {
      if (error instanceof CustomerNotFoundError) return null;
      throw error;
    }
  }
}

const paginate = <T, R>(
  values: T[],
  cursor: string | undefined,
  limit: number,
  mapper: (value: T) => R = (value: T) => value as unknown as R,
): CursorPage<R> => {
  const offset = decodeCursor(cursor);
  const page = values.slice(offset, offset + limit);
  return {
    items: page.map(mapper),
    nextCursor:
      offset + limit < values.length ? encodeCursor(offset + limit) : null,
  };
};

const appliesTo = (
  product: Product,
  promotion: Awaited<ReturnType<PromotionService['list']>>[number],
) =>
  !promotion.targets.length ||
  promotion.targets.some(
    (target) =>
      target.productId === product.id ||
      target.brandId === product.brandId ||
      target.categoryId === product.categoryId ||
      product.variants.some((variant) => target.variantId === variant.id),
  );

const encodeCursor = (offset: number): string =>
  Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');

const decodeCursor = (cursor?: string): number => {
  if (!cursor) return 0;
  try {
    const value = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { offset?: unknown };
    if (!Number.isInteger(value.offset) || Number(value.offset) < 0)
      throw new CatalogValidationError('El cursor no es válido.');
    return Number(value.offset);
  } catch (error) {
    if (error instanceof CatalogValidationError) throw error;
    throw new CatalogValidationError('El cursor no es válido.');
  }
};
