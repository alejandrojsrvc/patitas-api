-- CreateFunction
CREATE OR REPLACE FUNCTION "public"."update_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- CreateTable
CREATE TABLE "public"."products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "line" TEXT,
    "species" TEXT,
    "life_stage" TEXT,
    "breed_size" TEXT,
    "estimated_daily_grams_per_kg" NUMERIC,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "sku" TEXT,
    "weight_grams" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "public"."products"("slug");
CREATE INDEX "idx_products_brand" ON "public"."products"("brand");
CREATE INDEX "idx_products_species" ON "public"."products"("species");
CREATE INDEX "idx_products_enabled" ON "public"."products"("enabled");
CREATE UNIQUE INDEX "product_variants_product_id_weight_grams_key" ON "public"."product_variants"("product_id", "weight_grams");
CREATE INDEX "idx_product_variants_product_id" ON "public"."product_variants"("product_id");
CREATE INDEX "idx_product_variants_enabled" ON "public"."product_variants"("enabled");

-- AddForeignKey
ALTER TABLE "public"."product_variants"
ADD CONSTRAINT "product_variants_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateTrigger
CREATE TRIGGER "products_updated_at"
BEFORE UPDATE ON "public"."products"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_updated_at"();
