import { CatalogTaxonomyService } from '../../../src/modules/catalog/application/catalog-taxonomy.service';
import { FoodType, LifeStage, Species, type Brand } from '../../../src/modules/catalog/domain/catalog.types';
import type { CatalogRepository } from '../../../src/modules/catalog/domain/repositories/catalog.repository';

const royalCanin: Brand = {
  id: 'brand-1',
  name: 'Royal Canin',
  slug: 'royal-canin',
  description: null,
  seoTitle: null,
  seoDescription: null,
  logoUrl: null,
  displayOrder: 0,
  active: true,
};

describe('CatalogTaxonomyService', () => {
  const repository = {
    listBrands: jest.fn().mockResolvedValue([royalCanin]),
    listPublicBrandTaxonomyCombinations: jest.fn().mockResolvedValue([
      { species: Species.DOG, foodType: FoodType.DRY, lifeStage: null, brand: royalCanin },
      { species: Species.DOG, foodType: FoodType.DRY, lifeStage: LifeStage.ADULT, brand: royalCanin },
    ]),
  } as unknown as CatalogRepository;
  const service = new CatalogTaxonomyService(repository);

  it('resuelve la taxonomía comercial sin cambiar el modelo de dominio', async () => {
    await expect(service.resolveCatalogPath('/perros/alimentos-balanceados/cachorros')).resolves.toMatchObject({
      kind: 'LANDING',
      filters: {
        species: Species.DOG,
        category: 'FOOD',
        foodType: FoodType.DRY,
        lifeStage: LifeStage.PUPPY,
      },
      seo: { canonical: '/perros/alimentos-balanceados/cachorros' },
    });
  });

  it('construye la ruta canónica desde filtros técnicos', async () => {
    await expect(
      service.buildCatalogPath({
        species: Species.DOG,
        category: 'FOOD',
        foodType: FoodType.DRY,
        lifeStage: LifeStage.PUPPY,
      }),
    ).resolves.toBe('/perros/alimentos-balanceados/cachorros');
  });

  it('registra la marca al final solo cuando existe una combinación activa', async () => {
    await expect(service.resolveCatalogPath('/perros/alimentos-balanceados/adultos/royal-canin')).resolves.toMatchObject({
      kind: 'LANDING',
      filters: { species: Species.DOG, foodType: FoodType.DRY, lifeStage: LifeStage.ADULT, brand: 'royal-canin' },
    });
    await expect(service.resolveCatalogPath('/perros/alimentos-balanceados/adultos/excellent')).rejects.toMatchObject({
      code: 'CATALOG_NOT_FOUND',
    });
  });

  it.each(['/perros/alimentos-balanceados/gatitos', '/gatos/alimentos-balanceados/cachorros', '/perros/arena', '/perros/snacks/royal-canin'])(
    'rechaza la combinación inválida %s',
    async (path) => {
      await expect(service.resolveCatalogPath(path)).rejects.toMatchObject({ code: 'CATALOG_NOT_FOUND' });
    },
  );

  it('redirige rutas históricas válidas con 308', async () => {
    await expect(service.resolveCatalogPath('/perros/alimentos/secos/adulto')).resolves.toEqual({
      kind: 'REDIRECT',
      statusCode: 308,
      destination: '/perros/alimentos-balanceados/adultos',
    });
  });
});
