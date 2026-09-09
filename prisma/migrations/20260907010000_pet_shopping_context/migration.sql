ALTER TABLE "pets"
  ADD COLUMN "current_food_product_id" UUID,
  ADD COLUMN "current_food_variant_id" UUID,
  ADD COLUMN "current_food_brand" TEXT,
  ADD COLUMN "current_food_name" TEXT,
  ADD COLUMN "current_food_weight_grams" INTEGER;

ALTER TABLE "pets"
  ADD CONSTRAINT "pets_current_food_product_id_fkey"
  FOREIGN KEY ("current_food_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "pets_current_food_variant_id_fkey"
  FOREIGN KEY ("current_food_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_pets_current_food_product" ON "pets"("current_food_product_id");

ALTER TABLE "cart_items" ADD COLUMN "context_key" TEXT NOT NULL DEFAULT 'CASUAL';

UPDATE "cart_items"
SET "context_key" = CASE
  WHEN "plan_id" IS NOT NULL THEN 'PLAN:' || "plan_id"::text
  WHEN "pet_id" IS NOT NULL THEN 'PET:' || "pet_id"::text
  ELSE 'CASUAL'
END;

DROP INDEX "cart_items_cart_variant_key";
ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_cart_variant_context_key"
  UNIQUE ("cart_id", "variant_id", "context_key");
