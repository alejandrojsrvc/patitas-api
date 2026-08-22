-- Enums
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "SupplierOfferStockStatus" AS ENUM ('AVAILABLE', 'OUT_OF_STOCK', 'ON_REQUEST', 'UNKNOWN');
CREATE TYPE "PricingRuleSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');
CREATE TYPE "PricingReviewStatus" AS ENUM ('PENDING', 'APPLIED', 'SUPERSEDED');

-- Users
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER';

-- Catalog reference data
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "idx_categories_active" ON "categories"("active");
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");
CREATE INDEX "idx_brands_active" ON "brands"("active");

INSERT INTO "brands" ("name", "slug")
SELECT DISTINCT
    "brand",
    lower(regexp_replace(translate("brand", 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', '-', 'g'))
FROM "products";

ALTER TABLE "products"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "brand_id" UUID,
    ADD COLUMN "category_id" UUID,
    ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "products" AS p
SET "brand_id" = b."id"
FROM "brands" AS b
WHERE b."name" = p."brand";

ALTER TABLE "products" ALTER COLUMN "brand_id" SET NOT NULL;
DROP INDEX "idx_products_brand";
DROP INDEX "idx_products_enabled";
ALTER TABLE "products" DROP COLUMN "brand", DROP COLUMN "enabled";
CREATE INDEX "idx_products_brand_id" ON "products"("brand_id");
CREATE INDEX "idx_products_category_id" ON "products"("category_id");
CREATE INDEX "idx_products_status" ON "products"("status");
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sellable variants
DROP INDEX "idx_product_variants_enabled";
ALTER TABLE "product_variants" RENAME COLUMN "enabled" TO "active";
ALTER TABLE "product_variants"
    ADD COLUMN "presentation" TEXT,
    ADD COLUMN "sale_price" DECIMAL(14,2),
    ADD COLUMN "compare_at_price" DECIMAL(14,2),
    ADD COLUMN "preferred_supplier_offer_id" UUID,
    ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "product_variants"
SET "presentation" = CASE
    WHEN "weight_grams" IS NULL THEN NULL
    ELSE "weight_grams"::text || ' g'
END;

CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE UNIQUE INDEX "product_variants_preferred_offer_key" ON "product_variants"("preferred_supplier_offer_id");
CREATE INDEX "idx_product_variants_active" ON "product_variants"("active");

-- Suppliers
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "supplier_sku" TEXT,
    "unit_cost" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "stock_status" "SupplierOfferStockStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lead_time_hours" INTEGER,
    "minimum_quantity" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_suppliers_active" ON "suppliers"("active");
CREATE UNIQUE INDEX "supplier_offers_supplier_variant_key" ON "supplier_offers"("supplier_id", "variant_id");
CREATE INDEX "idx_supplier_offers_variant_id" ON "supplier_offers"("variant_id");
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_preferred_supplier_offer_id_fkey" FOREIGN KEY ("preferred_supplier_offer_id") REFERENCES "supplier_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pricing
CREATE TABLE "pricing_rule_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" INTEGER NOT NULL,
    "status" "PricingRuleSetStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "fulfillment_cost" DECIMAL(14,2),
    "packaging_cost" DECIMAL(14,2),
    "payment_fixed_cost" DECIMAL(14,2),
    "payment_fee_percent" DECIMAL(5,2),
    "subsidized_shipping_cost" DECIMAL(14,2),
    "tax_percent" DECIMAL(5,2),
    "other_cost" DECIMAL(14,2),
    "target_margin_percent" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ,
    CONSTRAINT "pricing_rule_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pricing_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "supplier_offer_id" UUID NOT NULL,
    "pricing_rule_set_id" UUID NOT NULL,
    "status" "PricingReviewStatus" NOT NULL DEFAULT 'PENDING',
    "variant_revision" INTEGER NOT NULL,
    "supplier_revision" INTEGER NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "recommended_price" DECIMAL(14,2) NOT NULL,
    "commercial_price" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMPTZ,
    CONSTRAINT "pricing_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pricing_rule_sets_version_key" ON "pricing_rule_sets"("version");
CREATE INDEX "idx_pricing_rule_sets_status" ON "pricing_rule_sets"("status");
CREATE INDEX "idx_pricing_reviews_variant_status" ON "pricing_reviews"("variant_id", "status");
ALTER TABLE "pricing_reviews" ADD CONSTRAINT "pricing_reviews_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pricing_reviews" ADD CONSTRAINT "pricing_reviews_supplier_offer_id_fkey" FOREIGN KEY ("supplier_offer_id") REFERENCES "supplier_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pricing_reviews" ADD CONSTRAINT "pricing_reviews_pricing_rule_set_id_fkey" FOREIGN KEY ("pricing_rule_set_id") REFERENCES "pricing_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "pricing_rule_sets" ("id", "version", "status", "currency")
VALUES ('00000000-0000-4000-8000-000000000010', 1, 'DRAFT', 'ARS');

-- Keep updated_at consistent for writes outside Prisma.
CREATE TRIGGER "categories_updated_at" BEFORE UPDATE ON "categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "brands_updated_at" BEFORE UPDATE ON "brands" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "product_variants_updated_at" BEFORE UPDATE ON "product_variants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "suppliers_updated_at" BEFORE UPDATE ON "suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "supplier_offers_updated_at" BEFORE UPDATE ON "supplier_offers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
