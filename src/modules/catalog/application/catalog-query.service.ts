import { CatalogValidationError } from '../domain/errors/catalog.error';
import { categorySlugFor } from '../domain/catalog-classification';
import { ProductCategory, type CatalogProductQuery, type PublicProductFilter } from '../domain/catalog.types';
import type { CatalogRepository } from '../domain/repositories/catalog.repository';

export class CatalogQueryService {
  public constructor(private readonly repository: CatalogRepository) {}

  public async resolve(input: CatalogProductQuery): Promise<PublicProductFilter> {
    if (input.foodType && input.category && input.category !== ProductCategory.FOOD) {
      throw new CatalogValidationError('foodType solo se puede utilizar con category=FOOD.');
    }
    const category = input.foodType ? ProductCategory.FOOD : input.category;
    if (input.lifeStage && category && category !== ProductCategory.FOOD) {
      throw new CatalogValidationError('lifeStage solo se puede utilizar con alimentos.');
    }
    if (input.minPrice && input.maxPrice && Number(input.minPrice) > Number(input.maxPrice)) {
      throw new CatalogValidationError('minPrice no puede ser mayor que maxPrice.');
    }

    const derivedSlug = category ? categorySlugFor(category, input.foodType) : undefined;
    const categorySlug = input.categorySlug ?? derivedSlug;
    if (categorySlug) await this.ensureCategoryBelongsTo(categorySlug, derivedSlug);

    const filter = { ...input };
    delete filter.foodType;
    delete filter.categorySlug;
    return { ...filter, category: categorySlug };
  }

  private async ensureCategoryBelongsTo(categorySlug: string, expectedRootSlug?: string): Promise<void> {
    const categories = (await this.repository.listCategories(false)).filter((category) => category.active);
    const byId = new Map(categories.map((category) => [category.id, category]));
    let current = categories.find((category) => category.slug === categorySlug);
    if (!current) throw new CatalogValidationError('categorySlug no corresponde a una categoría activa.');
    if (!expectedRootSlug) return;
    while (current) {
      if (current.slug === expectedRootSlug) return;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    throw new CatalogValidationError(`categorySlug no pertenece a ${expectedRootSlug}.`);
  }
}
