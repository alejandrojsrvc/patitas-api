import type { Cart } from '../domain/cart.types';

export const toMobileCart = (cart: Cart) => ({
  id: cart.id,
  source: cart.source,
  status: cart.status,
  currency: cart.currency,
  subtotal: cart.subtotal,
  updatedAt: cart.lastActivityAt.toISOString(),
  items: cart.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    name: item.productName,
    slug: item.slug,
    sku: item.sku,
    presentation: item.presentation,
    imageUrl: item.imageUrl,
    unitPrice: item.unitPrice,
    currency: cart.currency,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    purchasable: item.availableQuantity >= item.quantity,
    availability:
      item.availableQuantity >= item.quantity ? 'TODAY' : 'OUT_OF_STOCK',
    context: {
      role: item.role,
      petId: item.petId,
      planId: item.planId,
    },
  })),
});
