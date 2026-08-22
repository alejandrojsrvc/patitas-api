-- Public catalog taxonomy and merchandising metadata.
ALTER TABLE "categories"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "seo_title" TEXT,
    ADD COLUMN "seo_description" TEXT,
    ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "parent_id" UUID;

ALTER TABLE "brands"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "seo_title" TEXT,
    ADD COLUMN "seo_description" TEXT,
    ADD COLUMN "logo_url" TEXT,
    ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "products" ADD COLUMN "featured_rank" INTEGER;

CREATE INDEX "idx_categories_parent_id" ON "categories"("parent_id");
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "categories" ("id", "name", "slug", "display_order") VALUES
    ('10000000-0000-4000-8000-000000000001', 'Alimentos', 'alimentos', 10),
    ('10000000-0000-4000-8000-000000000002', 'Alimento seco', 'alimento-seco', 11),
    ('10000000-0000-4000-8000-000000000003', 'Alimento húmedo', 'alimento-humedo', 12),
    ('10000000-0000-4000-8000-000000000004', 'Snacks', 'snacks', 20),
    ('10000000-0000-4000-8000-000000000005', 'Arena y piedras', 'arena-y-piedras', 30),
    ('10000000-0000-4000-8000-000000000006', 'Paseo', 'paseo', 40),
    ('10000000-0000-4000-8000-000000000007', 'Bolsas para paseo', 'bolsas-para-paseo', 41)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "categories" SET "parent_id" = '10000000-0000-4000-8000-000000000001'
WHERE "slug" IN ('alimento-seco', 'alimento-humedo');
UPDATE "categories" SET "parent_id" = '10000000-0000-4000-8000-000000000006'
WHERE "slug" = 'bolsas-para-paseo';

-- The versioned starter catalog contains only dry food. Products remain DRAFT
-- until a real image, public price and fulfillment state are configured.
UPDATE "products"
SET "category_id" = (SELECT "id" FROM "categories" WHERE "slug" = 'alimento-seco')
WHERE "category_id" IS NULL;

-- Normalize pre-publication product slugs to stable ASCII URLs.
UPDATE "products"
SET "slug" = trim(both '-' from lower(regexp_replace(
    translate("slug", 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
    '[^a-zA-Z0-9]+', '-', 'g'
)));

CREATE TABLE "product_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "url" TEXT NOT NULL,
    "alt_text" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_product_media_product_order" ON "product_media"("product_id", "display_order");
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "feeding_guides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "source_label" TEXT NOT NULL,
    "source_url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "required_dimensions" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feeding_guides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feeding_guides_product_version_key" ON "feeding_guides"("product_id", "version");
CREATE INDEX "idx_feeding_guides_product_active" ON "feeding_guides"("product_id", "active");
ALTER TABLE "feeding_guides" ADD CONSTRAINT "feeding_guides_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "feeding_guide_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "feeding_guide_id" UUID NOT NULL,
    "pet_weight_kg" DECIMAL(7,2) NOT NULL,
    "life_stage" TEXT,
    "conditions" JSONB,
    "daily_grams_min" DECIMAL(8,2) NOT NULL,
    "daily_grams_max" DECIMAL(8,2) NOT NULL,
    CONSTRAINT "feeding_guide_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feeding_guide_entries_daily_range_check" CHECK ("daily_grams_min" > 0 AND "daily_grams_max" >= "daily_grams_min")
);
CREATE INDEX "idx_feeding_entries_guide_weight" ON "feeding_guide_entries"("feeding_guide_id", "pet_weight_kg");
ALTER TABLE "feeding_guide_entries" ADD CONSTRAINT "feeding_guide_entries_feeding_guide_id_fkey"
    FOREIGN KEY ("feeding_guide_id") REFERENCES "feeding_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_items_quantities_check" CHECK ("on_hand" >= 0 AND "reserved" >= 0 AND "reserved" <= "on_hand")
);
CREATE UNIQUE INDEX "inventory_items_variant_key" ON "inventory_items"("variant_id");
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER "feeding_guides_updated_at" BEFORE UPDATE ON "feeding_guides"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "inventory_items_updated_at" BEFORE UPDATE ON "inventory_items"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
