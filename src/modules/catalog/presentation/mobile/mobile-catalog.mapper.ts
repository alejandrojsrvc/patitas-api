import type { Product, ProductVariant } from '../../domain/catalog.types';
import type { ShippingQuote } from '../../../shipping/domain/shipping.types';

export type MobileFulfillmentContext = {
  shippingQuote?: ShippingQuote;
  now?: Date;
};

export const toMobileCategory = (category: {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  displayOrder: number;
}) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  parentId: category.parentId,
  sortOrder: category.displayOrder,
});

export const toMobileProduct = (
  product: Product,
  shippingQuotes = new Map<string, ShippingQuote>(),
  now = new Date(),
) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  description: product.description,
  species: product.species,
  brand: toMobileReference(product.brand),
  category: product.category ? toMobileReference(product.category) : null,
  image: product.media[0]
    ? { url: product.media[0].url, altText: product.media[0].altText }
    : null,
  images: product.media.map((media) => ({
    url: media.url,
    altText: media.altText,
  })),
  variants: product.variants.map((variant) =>
    toMobileVariant(variant, {
      shippingQuote: shippingQuotes.get(variant.id),
      now,
    }),
  ),
});

export const toMobileVariant = (
  variant: ProductVariant,
  context: MobileFulfillmentContext = {},
) => ({
  id: variant.id,
  sku: variant.sku,
  presentation: variant.presentation,
  weightGrams: variant.weightGrams,
  salePrice: variant.salePrice ?? '0.00',
  compareAtPrice: variant.compareAtPrice,
  currency: 'ARS' as const,
  fulfillment: toMobileFulfillment(variant, context),
});

export const toMobileFulfillment = (
  variant: ProductVariant,
  context: MobileFulfillmentContext = {},
) => {
  if (variant.fulfillment) {
    const shippingAvailable =
      !context.shippingQuote || context.shippingQuote.available;
    const shippingDate = context.shippingQuote?.available
      ? (context.shippingQuote.deliverySlots[0]?.date ?? null)
      : null;
    const deliveryDate = maxDate(
      variant.fulfillment.deliveryDate,
      shippingDate,
    );
    return {
      status: variant.fulfillment.status,
      purchasable: variant.fulfillment.purchasable && shippingAvailable,
      leadTimeHours:
        variant.fulfillment.source === 'OWN_STOCK'
          ? 0
          : variant.supplierLeadTimeHours,
      availability: variant.fulfillment.availability,
      earliestDeliveryDate: deliveryDate,
      orderBefore: variant.fulfillment.orderBefore,
    };
  }
  const onRequest =
    variant.availableQuantity <= 0 &&
    ['AVAILABLE', 'ON_REQUEST'].includes(variant.supplierStockStatus ?? '') &&
    isValidLeadTime(variant.supplierLeadTimeHours);
  const inStock = variant.availableQuantity > 0;
  const status = inStock
    ? 'IN_STOCK'
    : onRequest
      ? 'ON_REQUEST'
      : 'OUT_OF_STOCK';
  const basePurchasable = inStock || onRequest;
  const shippingAvailable =
    !context.shippingQuote || context.shippingQuote.available;
  const leadTimeHours = inStock
    ? 0
    : onRequest
      ? variant.supplierLeadTimeHours
      : null;
  const earliestDeliveryDate = earliestDate(
    leadTimeHours,
    context.shippingQuote,
    context.now ?? new Date(),
  );

  return {
    status,
    purchasable: basePurchasable && shippingAvailable,
    leadTimeHours,
    availability: inStock ? 'TODAY' : onRequest ? 'TOMORROW' : 'OUT_OF_STOCK',
    earliestDeliveryDate,
    orderBefore: context.shippingQuote?.available
      ? (context.shippingQuote.cutoffs[0]?.time ?? null)
      : null,
  };
};

const maxDate = (left: string | null, right: string | null): string | null => {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
};

export const toMobileOffer = (promotion: {
  id: string;
  name: string;
  type: string;
  kind: string;
  value: string;
  startsAt: Date | null;
  endsAt: Date | null;
}) => ({
  id: promotion.id,
  type: mobileOfferType(promotion.kind, promotion.type),
  title: promotion.name,
  description: promotion.name,
  percentage: promotion.type === 'PERCENTAGE' ? promotion.value : null,
  amount: promotion.type === 'FIXED' ? promotion.value : null,
  currency: promotion.type === 'FIXED' ? ('ARS' as const) : null,
  appliesAutomatically: true,
  startsAt: promotion.startsAt,
  endsAt: promotion.endsAt,
});

const toMobileReference = (reference: {
  id: string;
  name: string;
  slug: string;
}) => ({ id: reference.id, name: reference.name, slug: reference.slug });

const isValidLeadTime = (value: number | null): value is number =>
  value !== null && Number.isInteger(value) && value >= 0;

const earliestDate = (
  leadTimeHours: number | null,
  quote: ShippingQuote | undefined,
  now: Date,
): string | null => {
  const leadDate =
    leadTimeHours === null
      ? null
      : dateOnly(new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000));
  const shippingDate = quote?.available
    ? (quote.deliverySlots[0]?.date ?? null)
    : null;
  if (!leadDate) return shippingDate;
  if (!shippingDate) return leadDate;
  return shippingDate < leadDate ? leadDate : shippingDate;
};

const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const mobileOfferType = (kind: string, type: string): string => {
  if (kind === 'FREE_SHIPPING') return 'FREE_SHIPPING';
  if (type === 'PERCENTAGE') return 'PERCENTAGE_DISCOUNT';
  return 'FIXED_DISCOUNT';
};
