-- Case-insensitive prefix indexes for the public product autocomplete query.
-- The predicates keep inactive and non-sellable catalog records out of these
-- indexes because autocomplete never returns them.
CREATE INDEX "idx_products_active_name_prefix"
    ON "products" (lower("name") text_pattern_ops)
    WHERE "status" = 'ACTIVE';

CREATE INDEX "idx_brands_active_name_prefix"
    ON "brands" (lower("name") text_pattern_ops)
    WHERE "active" = TRUE;

CREATE INDEX "idx_product_variants_sellable_presentation_prefix"
    ON "product_variants" (lower("presentation") text_pattern_ops)
    WHERE "active" = TRUE
      AND "sku" IS NOT NULL
      AND "sale_price" > 0;

CREATE INDEX "idx_product_variants_sellable_sku_prefix"
    ON "product_variants" (lower("sku") text_pattern_ops)
    WHERE "active" = TRUE
      AND "sku" IS NOT NULL
      AND "sale_price" > 0;

CREATE INDEX "idx_product_variants_sellable_barcode_prefix"
    ON "product_variants" (lower("barcode") text_pattern_ops)
    WHERE "active" = TRUE
      AND "sku" IS NOT NULL
      AND "sale_price" > 0;
