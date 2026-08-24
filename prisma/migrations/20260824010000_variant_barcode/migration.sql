ALTER TABLE "product_variants"
    ADD COLUMN "barcode" TEXT;

CREATE UNIQUE INDEX "product_variants_barcode_key"
    ON "product_variants"("barcode");

ALTER TABLE "products"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "product_variants"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "product_media"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
