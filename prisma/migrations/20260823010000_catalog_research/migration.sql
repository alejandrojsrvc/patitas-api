CREATE TYPE "CatalogSourceStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'BLOCKED', 'ERROR');
CREATE TYPE "RetailPriceMatchStatus" AS ENUM ('MATCHED', 'MISMATCH', 'MISSING', 'AMBIGUOUS', 'BLOCKED');

ALTER TABLE "products"
    ADD COLUMN "ingredients_text" TEXT,
    ADD COLUMN "analytical_composition" JSONB;

ALTER TABLE "feeding_guide_entries"
    RENAME COLUMN "pet_weight_kg" TO "pet_weight_kg_min";

ALTER INDEX "idx_feeding_entries_guide_weight"
    RENAME TO "idx_feeding_entries_guide_weight_old";

ALTER TABLE "feeding_guide_entries"
    ADD COLUMN "pet_weight_kg_max" DECIMAL(7,2),
    ALTER COLUMN "daily_grams_max" DROP NOT NULL;

UPDATE "feeding_guide_entries"
SET "pet_weight_kg_max" = "pet_weight_kg_min"
WHERE "pet_weight_kg_max" IS NULL;

CREATE INDEX "idx_feeding_entries_guide_weight"
    ON "feeding_guide_entries"("feeding_guide_id", "pet_weight_kg_min");

DROP INDEX "idx_feeding_entries_guide_weight_old";

CREATE TABLE "product_source_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "fetched_at" TIMESTAMPTZ NOT NULL,
    "content_hash" TEXT NOT NULL,
    "extractor_version" TEXT NOT NULL,
    "status" "CatalogSourceStatus" NOT NULL,
    "payload" JSONB,
    "warnings" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_source_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_source_snapshots_product_hash_key"
    ON "product_source_snapshots"("product_id", "content_hash");
CREATE INDEX "idx_product_source_snapshots_product_fetched"
    ON "product_source_snapshots"("product_id", "fetched_at");
ALTER TABLE "product_source_snapshots"
    ADD CONSTRAINT "product_source_snapshots_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "retail_price_observations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "retailer_code" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "external_product_id" TEXT,
    "external_variant_id" TEXT,
    "title_snapshot" TEXT,
    "weight_grams" INTEGER,
    "bonus_weight_grams" INTEGER,
    "price" DECIMAL(14,2),
    "list_price" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "price_condition" TEXT,
    "match_status" "RetailPriceMatchStatus" NOT NULL,
    "warnings" JSONB,
    "run_id" TEXT NOT NULL,
    "observed_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retail_price_observations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_retail_price_observations_variant_retailer_date"
    ON "retail_price_observations"("variant_id", "retailer_code", "observed_at");
CREATE INDEX "idx_retail_price_observations_retailer_date"
    ON "retail_price_observations"("retailer_code", "observed_at");
CREATE INDEX "idx_retail_price_observations_run_id"
    ON "retail_price_observations"("run_id");
ALTER TABLE "retail_price_observations"
    ADD CONSTRAINT "retail_price_observations_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
