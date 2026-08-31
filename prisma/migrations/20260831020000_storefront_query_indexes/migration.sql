-- Índices para lecturas públicas del ecommerce. Son parciales para no aumentar
-- innecesariamente el costo de escritura de borradores o variantes no vendibles.

CREATE INDEX IF NOT EXISTS "idx_product_variants_sellable_product_price"
ON "product_variants" ("product_id", "sale_price")
WHERE "active" = true AND "sku" IS NOT NULL AND "sale_price" > 0;

CREATE INDEX IF NOT EXISTS "idx_product_variants_sellable_weight_product"
ON "product_variants" ("weight_grams", "product_id")
WHERE "active" = true AND "sku" IS NOT NULL AND "sale_price" > 0;

CREATE INDEX IF NOT EXISTS "idx_products_public_category_species_brand"
ON "products" ("category_id", "species", "brand_id")
WHERE "status" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "idx_orders_customer_created_desc"
ON "orders" ("customer_id", "created_at" DESC)
WHERE "customer_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_carts_active_customer_source_activity"
ON "carts" ("customer_id", "source", "last_activity_at" DESC)
WHERE "status" = 'ACTIVE' AND "customer_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_carts_active_anonymous_source_activity"
ON "carts" ("anonymous_token_hash", "source", "last_activity_at" DESC)
WHERE "status" = 'ACTIVE' AND "anonymous_token_hash" IS NOT NULL;
