-- Supplier fulfillment metadata is operational configuration, not customer data.
CREATE TYPE "SupplierOfferFulfillmentMode" AS ENUM ('STANDARD', 'EXPRESS');

CREATE TABLE "fulfillment_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "depot_cutoff" VARCHAR(5) NOT NULL DEFAULT '14:00',
    "same_day_enabled" BOOLEAN NOT NULL DEFAULT true,
    "depot_handling_minutes" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fulfillment_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fulfillment_settings_depot_cutoff_check"
      CHECK ("depot_cutoff" ~ '^[0-2][0-9]:[0-5][0-9]$'),
    CONSTRAINT "fulfillment_settings_depot_handling_check"
      CHECK ("depot_handling_minutes" >= 0)
);

ALTER TABLE "supplier_offers"
  ADD COLUMN "fulfillment_mode" "SupplierOfferFulfillmentMode" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "supplier_cutoff" VARCHAR(5),
  ADD COLUMN "supplier_to_depot_minutes" INTEGER,
  ADD COLUMN "fulfillment_cost" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "supplier_offers"
  ADD CONSTRAINT "supplier_offers_supplier_cutoff_check"
    CHECK ("supplier_cutoff" IS NULL OR "supplier_cutoff" ~ '^[0-2][0-9]:[0-5][0-9]$'),
  ADD CONSTRAINT "supplier_offers_supplier_to_depot_check"
    CHECK ("supplier_to_depot_minutes" IS NULL OR "supplier_to_depot_minutes" >= 0),
  ADD CONSTRAINT "supplier_offers_fulfillment_cost_check"
    CHECK ("fulfillment_cost" >= 0);

INSERT INTO "fulfillment_settings" ("id") VALUES (gen_random_uuid());

CREATE INDEX "idx_supplier_offers_fulfillment" ON "supplier_offers"("active", "fulfillment_mode", "stock_status");
