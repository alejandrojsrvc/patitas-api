-- Keep variant-specific media attached to a variant of the same product.
CREATE UNIQUE INDEX "product_variants_id_product_id_key"
    ON "product_variants"("id", "product_id");

ALTER TABLE "product_media"
    DROP CONSTRAINT "product_media_variant_id_fkey";

ALTER TABLE "product_media"
    ADD CONSTRAINT "product_media_variant_product_fkey"
    FOREIGN KEY ("variant_id", "product_id")
    REFERENCES "product_variants"("id", "product_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
