import { FoodType, LifeStage, ProductCategory, Species, type Brand, type CatalogBrandCombination, type CatalogProductQuery } from './catalog.types';
import { CATEGORY_SLUGS } from './catalog-classification';

export interface CatalogBreadcrumb {
  label: string;
  href: string;
}

export interface CatalogSeo {
  title: string;
  h1: string;
  description: string;
  canonical: string;
  robots: { index: true; follow: true };
}

export interface CatalogLanding {
  kind: 'LANDING';
  landingType: 'CATALOG' | 'BRAND_INDEX' | 'BRAND';
  filters: Partial<CatalogProductQuery>;
  seo: CatalogSeo;
  breadcrumbs: CatalogBreadcrumb[];
}

export interface CatalogRedirect {
  kind: 'REDIRECT';
  statusCode: 308;
  destination: string;
}

export type CatalogPathResolution = CatalogLanding | CatalogRedirect;

const speciesData = {
  [Species.DOG]: { slug: 'perros', singular: 'perro', plural: 'perros', puppy: 'cachorros' },
  [Species.CAT]: { slug: 'gatos', singular: 'gato', plural: 'gatos', puppy: 'gatitos' },
} as const;

const foodTypeData = {
  [FoodType.DRY]: { slug: 'alimentos-balanceados', singular: 'Alimento Balanceado', h1: 'Alimento balanceado' },
  [FoodType.WET]: { slug: 'alimentos-humedos', singular: 'Alimento Húmedo', h1: 'Alimento húmedo' },
} as const;

const stageSlug = (species: Species, stage: LifeStage) => {
  if (stage === LifeStage.PUPPY) return speciesData[species].puppy;
  if (stage === LifeStage.ADULT) return 'adultos';
  return 'senior';
};

const stageLabel = (species: Species, stage: LifeStage) => {
  if (stage === LifeStage.PUPPY) return species === Species.DOG ? 'Cachorros' : 'Gatitos';
  if (stage === LifeStage.ADULT) return 'Adultos';
  return 'Senior';
};

const breadcrumb = (label: string, href: string): CatalogBreadcrumb => ({ label, href });
const seo = (title: string, h1: string, description: string, canonical: string): CatalogSeo => ({
  title,
  h1,
  description,
  canonical,
  robots: { index: true, follow: true },
});

const catalogLanding = (
  filters: Partial<CatalogProductQuery>,
  canonical: string,
  title: string,
  h1: string,
  description: string,
  breadcrumbs: CatalogBreadcrumb[],
): CatalogLanding => ({ kind: 'LANDING', landingType: 'CATALOG', filters, seo: seo(title, h1, description, canonical), breadcrumbs });

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const staticLandings = (): CatalogLanding[] => {
  const result: CatalogLanding[] = [];
  for (const species of [Species.DOG, Species.CAT]) {
    const animal = speciesData[species];
    const root = `/${animal.slug}`;
    result.push(
      catalogLanding(
        { species },
        root,
        `Productos para ${capitalize(animal.plural)}`,
        `Todo para ${animal.plural}`,
        `Alimentos, snacks e higiene para acompañar la rutina de tu ${animal.singular}.`,
        [breadcrumb('Inicio', '/'), breadcrumb(capitalize(animal.plural), root)],
      ),
    );

    const foodPath = `${root}/alimentos`;
    result.push(
      catalogLanding(
        { species, category: ProductCategory.FOOD },
        foodPath,
        `Alimentos para ${capitalize(animal.plural)}`,
        `Alimentos para ${animal.plural}`,
        `Alimentos balanceados y húmedos para ${animal.plural}, organizados por etapa, marca y presentación.`,
        [breadcrumb('Inicio', '/'), breadcrumb(capitalize(animal.plural), root), breadcrumb('Alimentos', foodPath)],
      ),
    );

    for (const foodType of [FoodType.DRY, FoodType.WET]) {
      const food = foodTypeData[foodType];
      const typePath = `${root}/${food.slug}`;
      const typeBreadcrumbs = [
        breadcrumb('Inicio', '/'),
        breadcrumb(capitalize(animal.plural), root),
        breadcrumb('Alimentos', foodPath),
        breadcrumb(
          food.h1.replace(/^./, (value) => value.toUpperCase()),
          typePath,
        ),
      ];
      result.push(
        catalogLanding(
          { species, category: ProductCategory.FOOD, foodType },
          typePath,
          `${food.singular} para ${capitalize(animal.plural)}`,
          `${food.h1} para ${animal.plural}`,
          `${food.h1} para ${animal.plural}, con marcas y presentaciones fáciles de comparar.`,
          typeBreadcrumbs,
        ),
      );
      for (const lifeStage of [LifeStage.PUPPY, LifeStage.ADULT, LifeStage.SENIOR]) {
        const stage = stageLabel(species, lifeStage);
        const path = `${typePath}/${stageSlug(species, lifeStage)}`;
        result.push(
          catalogLanding(
            { species, category: ProductCategory.FOOD, foodType, lifeStage },
            path,
            `${food.singular} para ${capitalize(animal.plural)} ${stage}`,
            `${food.h1} para ${animal.plural} ${stage.toLowerCase()}`,
            `${food.h1} para ${animal.plural} ${stage.toLowerCase()}, con marcas y presentaciones para comparar.`,
            [...typeBreadcrumbs, breadcrumb(stage, path)],
          ),
        );
      }
    }

    const snacksPath = `${root}/snacks`;
    result.push(
      catalogLanding(
        { species, category: ProductCategory.SNACK },
        snacksPath,
        `Snacks y Premios para ${capitalize(animal.plural)}`,
        `Snacks para ${animal.plural}`,
        `Snacks y premios para sumar a la rutina de tu ${animal.singular}.`,
        [breadcrumb('Inicio', '/'), breadcrumb(capitalize(animal.plural), root), breadcrumb('Snacks', snacksPath)],
      ),
    );

    const hygienePath = `${root}/higiene`;
    result.push(
      catalogLanding(
        { species, category: ProductCategory.HYGIENE },
        hygienePath,
        `Higiene para ${capitalize(animal.plural)}`,
        `Higiene para ${animal.plural}`,
        `Productos de higiene para sostener el cuidado diario de tu ${animal.singular}.`,
        [breadcrumb('Inicio', '/'), breadcrumb(capitalize(animal.plural), root), breadcrumb('Higiene', hygienePath)],
      ),
    );

    const isDog = species === Species.DOG;
    const leafPath = `${hygienePath}/${isDog ? 'bolsas' : 'arena'}`;
    const leafLabel = isDog ? 'Bolsas' : 'Arena';
    result.push(
      catalogLanding(
        {
          species,
          category: ProductCategory.HYGIENE,
          categorySlug: isDog ? CATEGORY_SLUGS.bags : CATEGORY_SLUGS.litter,
        },
        leafPath,
        isDog ? 'Bolsitas para Perros' : 'Arena para Gatos',
        isDog ? 'Bolsitas para perros' : 'Arena para gatos',
        isDog ? 'Bolsitas para los paseos diarios de tu perro.' : 'Arena y piedras sanitarias para la higiene de tu gato.',
        [breadcrumb('Inicio', '/'), breadcrumb(capitalize(animal.plural), root), breadcrumb('Higiene', hygienePath), breadcrumb(leafLabel, leafPath)],
      ),
    );
  }
  return result;
};

export const STATIC_CATALOG_LANDINGS = staticLandings();

export const brandIndexLanding = (): CatalogLanding => ({
  kind: 'LANDING',
  landingType: 'BRAND_INDEX',
  filters: {},
  seo: seo('Marcas', 'Marcas', 'Encontrá alimentos y productos para perros y gatos por marca.', '/marcas'),
  breadcrumbs: [breadcrumb('Inicio', '/'), breadcrumb('Marcas', '/marcas')],
});

export const brandLanding = (brand: Brand): CatalogLanding => ({
  kind: 'LANDING',
  landingType: 'BRAND',
  filters: { brand: brand.slug },
  seo: seo(
    brand.seoTitle ?? `${brand.name}: productos para perros y gatos`,
    brand.name,
    brand.seoDescription ?? brand.description ?? `Productos ${brand.name} para perros y gatos, con presentaciones para comparar.`,
    `/marcas/${brand.slug}`,
  ),
  breadcrumbs: [breadcrumb('Inicio', '/'), breadcrumb('Marcas', '/marcas'), breadcrumb(brand.name, `/marcas/${brand.slug}`)],
});

export const brandedCatalogLanding = (combination: CatalogBrandCombination): CatalogLanding | null => {
  if (reservedBrandSlugs.has(combination.brand.slug)) return null;
  const base = STATIC_CATALOG_LANDINGS.find(
    (landing) =>
      landing.filters.species === combination.species &&
      landing.filters.category === ProductCategory.FOOD &&
      landing.filters.foodType === combination.foodType &&
      landing.filters.lifeStage === (combination.lifeStage ?? undefined),
  );
  if (!base) return null;
  const canonical = `${base.seo.canonical}/${combination.brand.slug}`;
  const animal = speciesData[combination.species];
  const food = foodTypeData[combination.foodType];
  const stage = combination.lifeStage ? ` ${stageLabel(combination.species, combination.lifeStage).toLowerCase()}` : '';
  return catalogLanding(
    { ...base.filters, brand: combination.brand.slug },
    canonical,
    `${food.singular} ${combination.brand.name} para ${capitalize(animal.plural)}${stage}`,
    `${food.h1} ${combination.brand.name} para ${animal.plural}${stage}`,
    `${food.h1} ${combination.brand.name} para ${animal.plural}${stage}, con presentaciones y disponibilidad para comparar.`,
    [...base.breadcrumbs, breadcrumb(combination.brand.name, canonical)],
  );
};

export const normalizeLegacyCatalogPath = (path: string): string => {
  let normalized = path
    .replace(/^\/(perros|gatos)\/alimentos\/secos(?=\/|$)/, '/$1/alimentos-balanceados')
    .replace(/^\/(perros|gatos)\/alimentos\/humedos(?=\/|$)/, '/$1/alimentos-humedos')
    .replace(/^\/perros\/bolsas$/, '/perros/higiene/bolsas')
    .replace(/^\/gatos\/arena$/, '/gatos/higiene/arena');
  normalized = normalized
    .split('/')
    .map((segment) => ({ cachorro: 'cachorros', gatito: 'gatitos', adulto: 'adultos' })[segment] ?? segment)
    .join('/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 4 && isFoodTypeSlug(segments[1]) && !isStageSlug(segments[2]) && isStageSlug(segments[3])) {
    normalized = `/${segments[0]}/${segments[1]}/${segments[3]}/${segments[2]}`;
  }
  return normalized;
};

export const validCatalogPath = (path: string): boolean => /^\/[a-z0-9]+(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(path);

const isFoodTypeSlug = (value: string) => ['alimentos-balanceados', 'alimentos-humedos'].includes(value);
const isStageSlug = (value: string) => ['cachorros', 'gatitos', 'adultos', 'senior'].includes(value);
const reservedBrandSlugs = new Set(['cachorros', 'gatitos', 'adultos', 'senior']);
