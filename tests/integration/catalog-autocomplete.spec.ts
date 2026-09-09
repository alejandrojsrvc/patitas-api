import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/infrastructure/database/generated/prisma/client';
import { PrismaCatalogRepository } from '../../src/modules/catalog/infrastructure/persistence/prisma-catalog.repository';
import { loadProjectEnv } from '../../scripts/load-project-env';

loadProjectEnv();

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/patitas';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

describe('catalog autocomplete database query', () => {
  afterAll(async () => prisma.$disconnect());

  it('returns one compact result per sellable variant and prefers variant media', async () => {
    const brandId = randomUUID();
    const categoryId = randomUUID();
    const productId = randomUUID();
    const variantId = randomUUID();
    const hiddenVariantId = randomUUID();
    const mediaId = randomUUID();
    const marker = productId.slice(0, 8);

    await prisma.brand.create({
      data: {
        id: brandId,
        name: `Autocomplete Brand ${marker}`,
        slug: `autocomplete-brand-${brandId}`,
      },
    });
    await prisma.category.create({
      data: {
        id: categoryId,
        name: `Autocomplete Category ${marker}`,
        slug: `autocomplete-category-${categoryId}`,
      },
    });
    await prisma.product.create({
      data: {
        id: productId,
        name: `Autocomplete Product ${marker}`,
        slug: `autocomplete-product-${productId}`,
        brandId,
        categoryId,
        status: 'ACTIVE',
      },
    });
    await prisma.productVariant.createMany({
      data: [
        {
          id: variantId,
          productId,
          sku: `AUTO-${marker}`,
          presentation: `15 kg ${marker}`,
          weightGrams: 15_000,
          salePrice: '25000.00',
          active: true,
        },
        {
          id: hiddenVariantId,
          productId,
          sku: `AUTO-HIDDEN-${hiddenVariantId}`,
          presentation: `7.5 kg ${marker}`,
          weightGrams: 7_500,
          salePrice: null,
          active: true,
        },
      ],
    });
    await prisma.productMedia.create({
      data: {
        id: mediaId,
        productId,
        variantId,
        url: `products/${productId}/variant.webp`,
        altText: 'Variante',
        displayOrder: 0,
      },
    });

    const repository = new PrismaCatalogRepository(prisma as never);
    try {
      const byBrand = await repository.autocompleteProductVariants(`autocomplete brand ${marker}`, 8);
      const byPresentation = await repository.autocompleteProductVariants(`15 kg ${marker}`, 8);
      const bySku = await repository.autocompleteProductVariants(`auto-${marker}`, 8);

      expect(byBrand).toHaveLength(1);
      expect(byBrand[0]).toMatchObject({
        id: variantId,
        productId,
        presentation: `15 kg ${marker}`,
        displayName: `Autocomplete Product ${marker} · 15 kg ${marker}`,
        image: {
          url: `products/${productId}/variant.webp`,
          altText: 'Variante',
        },
        salePrice: '25000.00',
      });
      expect(byPresentation[0]?.id).toBe(variantId);
      expect(bySku[0]?.id).toBe(variantId);
    } finally {
      await prisma.product.delete({ where: { id: productId } });
      await prisma.brand.delete({ where: { id: brandId } });
      await prisma.category.delete({ where: { id: categoryId } });
    }
  });
});
