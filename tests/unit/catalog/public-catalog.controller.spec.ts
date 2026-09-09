import { ValidationPipe } from '@nestjs/common';
import { CatalogService } from '../../../src/modules/catalog/application/catalog.service';
import { PublicCatalogController } from '../../../src/modules/catalog/presentation/controllers/public-catalog.controller';
import { PublicProductAutocompleteQueryDto } from '../../../src/modules/catalog/presentation/dto/catalog.dto';
import { PromotionService } from '../../../src/modules/promotions/application/promotion.service';

describe('Public catalog autocomplete controller', () => {
  const autocompleteProducts = jest.fn();
  const controller = new PublicCatalogController({ autocompleteProducts } as unknown as CatalogService, {} as unknown as PromotionService);

  beforeEach(() => {
    autocompleteProducts.mockReset();
    autocompleteProducts.mockResolvedValue([
      {
        id: 'variant-1',
        productId: 'product-1',
        slug: 'royal-canino',
        name: 'Royal Canino',
        presentation: '3 kg',
        displayName: 'Royal Canino · 3 kg',
        brand: { id: 'brand-1', name: 'Royal', slug: 'royal' },
        image: null,
        salePrice: '8990.00',
        currency: 'ARS',
      },
    ]);
  });

  it('returns the items envelope for the autocomplete query', async () => {
    await expect(controller.productAutocomplete({ q: 'roy' })).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'variant-1',
          displayName: 'Royal Canino · 3 kg',
        }),
      ],
    });
    expect(autocompleteProducts).toHaveBeenCalledWith('roy');
  });

  it('rejects unknown query parameters', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(pipe.transform({ q: 'roy', limit: 8 }, { type: 'query', metatype: PublicProductAutocompleteQueryDto })).rejects.toThrow();
  });
});
