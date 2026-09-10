import { FoodType, LifeStage, ProductCategory, Species, type Category } from './catalog.types';

export const CATEGORY_SLUGS = {
  food: 'alimentos',
  dryFood: 'alimento-seco',
  wetFood: 'alimento-humedo',
  snack: 'snacks',
  hygiene: 'higiene',
  bags: 'bolsas-para-paseo',
  litter: 'arena-y-piedras',
} as const;

export const normalizeCatalogSpecies = (value: unknown): Species | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['dog', 'perro', 'perros'].includes(normalized)) return Species.DOG;
  if (['cat', 'gato', 'gatos'].includes(normalized)) return Species.CAT;
  return null;
};

export const normalizeCatalogLifeStage = (value: unknown): LifeStage | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['puppy', 'puppies', 'kitten', 'kittens', 'cachorro', 'cachorros', 'gatito', 'gatitos'].includes(normalized)) {
    return LifeStage.PUPPY;
  }
  if (['adult', 'adults', 'adulto', 'adultos'].includes(normalized)) return LifeStage.ADULT;
  if (['senior', 'seniors'].includes(normalized)) return LifeStage.SENIOR;
  return null;
};

export const categorySlugFor = (category: ProductCategory, foodType?: FoodType): string => {
  if (category === ProductCategory.FOOD) {
    if (foodType === FoodType.DRY) return CATEGORY_SLUGS.dryFood;
    if (foodType === FoodType.WET) return CATEGORY_SLUGS.wetFood;
    return CATEGORY_SLUGS.food;
  }
  if (category === ProductCategory.SNACK) return CATEGORY_SLUGS.snack;
  return CATEGORY_SLUGS.hygiene;
};

export const classifyCategory = (
  category: Pick<Category, 'slug'> | null,
): {
  category: ProductCategory | null;
  foodType: FoodType | null;
} => {
  if (!category) return { category: null, foodType: null };
  if (category.slug === CATEGORY_SLUGS.dryFood) return { category: ProductCategory.FOOD, foodType: FoodType.DRY };
  if (category.slug === CATEGORY_SLUGS.wetFood) return { category: ProductCategory.FOOD, foodType: FoodType.WET };
  if (category.slug === CATEGORY_SLUGS.food) return { category: ProductCategory.FOOD, foodType: null };
  if (category.slug === CATEGORY_SLUGS.snack) return { category: ProductCategory.SNACK, foodType: null };
  const hygieneSlugs: readonly string[] = [CATEGORY_SLUGS.hygiene, CATEGORY_SLUGS.bags, CATEGORY_SLUGS.litter];
  if (hygieneSlugs.includes(category.slug)) {
    return { category: ProductCategory.HYGIENE, foodType: null };
  }
  return { category: null, foodType: null };
};
