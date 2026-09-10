BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "products"
    WHERE "species" IS NOT NULL
      AND btrim("species") <> ''
      AND lower(btrim("species")) NOT IN ('dog', 'perro', 'perros', 'cat', 'gato', 'gatos')
  ) THEN
    RAISE EXCEPTION 'No se puede migrar products.species: existen valores de especie no reconocidos.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "products"
    WHERE "life_stage" IS NOT NULL
      AND btrim("life_stage") <> ''
      AND lower(btrim("life_stage")) NOT IN (
        'puppy', 'puppies', 'kitten', 'kittens', 'cachorro', 'cachorros', 'gatito', 'gatitos',
        'adult', 'adults', 'adulto', 'adultos', 'senior', 'seniors'
      )
  ) OR EXISTS (
    SELECT 1
    FROM "feeding_guide_entries"
    WHERE "life_stage" IS NOT NULL
      AND btrim("life_stage") <> ''
      AND lower(btrim("life_stage")) NOT IN (
        'puppy', 'puppies', 'kitten', 'kittens', 'cachorro', 'cachorros', 'gatito', 'gatitos',
        'adult', 'adults', 'adulto', 'adultos', 'senior', 'seniors'
      )
  ) THEN
    RAISE EXCEPTION 'No se puede migrar life_stage: existen valores no reconocidos.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'higiene') THEN
    RAISE EXCEPTION 'No se puede reorganizar la taxonomía: falta la categoría higiene.';
  END IF;
END $$;

CREATE TYPE "Species" AS ENUM ('DOG', 'CAT');
CREATE TYPE "LifeStage" AS ENUM ('PUPPY', 'ADULT', 'SENIOR');

ALTER TABLE "products"
  ALTER COLUMN "species" TYPE "Species"
  USING CASE
    WHEN "species" IS NULL OR btrim("species") = '' THEN NULL
    WHEN lower(btrim("species")) IN ('dog', 'perro', 'perros') THEN 'DOG'::"Species"
    WHEN lower(btrim("species")) IN ('cat', 'gato', 'gatos') THEN 'CAT'::"Species"
  END,
  ALTER COLUMN "life_stage" TYPE "LifeStage"
  USING CASE
    WHEN "life_stage" IS NULL OR btrim("life_stage") = '' THEN NULL
    WHEN lower(btrim("life_stage")) IN ('puppy', 'puppies', 'kitten', 'kittens', 'cachorro', 'cachorros', 'gatito', 'gatitos') THEN 'PUPPY'::"LifeStage"
    WHEN lower(btrim("life_stage")) IN ('adult', 'adults', 'adulto', 'adultos') THEN 'ADULT'::"LifeStage"
    WHEN lower(btrim("life_stage")) IN ('senior', 'seniors') THEN 'SENIOR'::"LifeStage"
  END;

ALTER TABLE "feeding_guide_entries"
  ALTER COLUMN "life_stage" TYPE "LifeStage"
  USING CASE
    WHEN "life_stage" IS NULL OR btrim("life_stage") = '' THEN NULL
    WHEN lower(btrim("life_stage")) IN ('puppy', 'puppies', 'kitten', 'kittens', 'cachorro', 'cachorros', 'gatito', 'gatitos') THEN 'PUPPY'::"LifeStage"
    WHEN lower(btrim("life_stage")) IN ('adult', 'adults', 'adulto', 'adultos') THEN 'ADULT'::"LifeStage"
    WHEN lower(btrim("life_stage")) IN ('senior', 'seniors') THEN 'SENIOR'::"LifeStage"
  END;

UPDATE "categories" AS child
SET "parent_id" = parent."id",
    "updated_at" = CURRENT_TIMESTAMP
FROM "categories" AS parent
WHERE parent."slug" = 'higiene'
  AND child."slug" IN ('arena-y-piedras', 'bolsas-para-paseo')
  AND child."parent_id" IS DISTINCT FROM parent."id";

CREATE INDEX IF NOT EXISTS "idx_products_active_taxonomy_brand"
ON "products" ("species", "category_id", "life_stage", "brand_id")
WHERE "status" = 'ACTIVE';

COMMIT;
