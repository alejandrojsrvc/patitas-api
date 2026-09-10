import { CatalogQueryService } from '../../../src/modules/catalog/application/catalog-query.service';
import { FoodType, LifeStage, ProductCategory, Species } from '../../../src/modules/catalog/domain/catalog.types';
import type { CatalogRepository } from '../../../src/modules/catalog/domain/repositories/catalog.repository';

describe('CatalogQueryService', () => {
  const repository = {
    listCategories: jest.fn().mockResolvedValue([
      {
        id: 'food',
        name: 'Alimentos',
        slug: 'alimentos',
        parentId: null,
        active: true,
      },
      {
        id: 'dry',
        name: 'Alimento seco',
        slug: 'alimento-seco',
        parentId: 'food',
        active: true,
      },
    ]),
  } as unknown as CatalogRepository;
  const service = new CatalogQueryService(repository);

  it('convierte filtros técnicos en el slug persistido existente', async () => {
    await expect(
      service.resolve({
        species: Species.DOG,
        category: ProductCategory.FOOD,
        foodType: FoodType.DRY,
        lifeStage: LifeStage.PUPPY,
        page: 1,
        perPage: 24,
      }),
    ).resolves.toEqual({
      species: Species.DOG,
      category: 'alimento-seco',
      lifeStage: LifeStage.PUPPY,
      page: 1,
      perPage: 24,
    });
  });

  it('rechaza foodType fuera de FOOD', async () => {
    await expect(
      service.resolve({
        category: ProductCategory.HYGIENE,
        foodType: FoodType.DRY,
        page: 1,
        perPage: 24,
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_VALIDATION_FAILED' });
  });
});
