-- Configurable payment fee schedules and operating costs for pricing.
CREATE TYPE "PaymentFeeProvider" AS ENUM ('MERCADOPAGO');
CREATE TYPE "PaymentFeeProduct" AS ENUM ('CHECKOUT_PRO');
CREATE TYPE "OperatingCostType" AS ENUM ('FIXED_MONTHLY', 'PER_ORDER', 'PER_UNIT', 'PERCENT_OF_SALE');

CREATE TABLE "payment_fee_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "PaymentFeeProvider" NOT NULL,
    "product" "PaymentFeeProduct" NOT NULL,
    "name" TEXT NOT NULL,
    "settlement_days" INTEGER NOT NULL,
    "fee_percent" DECIMAL(5,2) NOT NULL,
    "vat_percent" DECIMAL(5,2) NOT NULL,
    "fixed_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_fee_schedules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_fee_schedules_settlement_days_check" CHECK ("settlement_days" >= 0),
    CONSTRAINT "payment_fee_schedules_fee_percent_check" CHECK ("fee_percent" >= 0 AND "fee_percent" <= 100),
    CONSTRAINT "payment_fee_schedules_vat_percent_check" CHECK ("vat_percent" >= 0 AND "vat_percent" <= 100),
    CONSTRAINT "payment_fee_schedules_fixed_fee_check" CHECK ("fixed_fee" >= 0)
);
CREATE UNIQUE INDEX "payment_fee_schedule_provider_product_days_key"
    ON "payment_fee_schedules"("provider", "product", "settlement_days");
CREATE INDEX "idx_payment_fee_schedules_lookup"
    ON "payment_fee_schedules"("provider", "product", "active");

ALTER TABLE "pricing_rule_sets"
    ADD COLUMN "payment_fee_vat_percent" DECIMAL(5,2),
    ADD COLUMN "payment_fee_schedule_id" UUID;
CREATE INDEX "idx_pricing_rule_sets_payment_fee_schedule"
    ON "pricing_rule_sets"("payment_fee_schedule_id");
ALTER TABLE "pricing_rule_sets"
    ADD CONSTRAINT "pricing_rule_sets_payment_fee_schedule_fkey"
    FOREIGN KEY ("payment_fee_schedule_id") REFERENCES "payment_fee_schedules"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "operating_costs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "OperatingCostType" NOT NULL,
    "amount" DECIMAL(14,2),
    "percent" DECIMAL(5,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operating_costs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operating_costs_amount_check" CHECK ("amount" IS NULL OR "amount" >= 0),
    CONSTRAINT "operating_costs_percent_check" CHECK ("percent" IS NULL OR ("percent" >= 0 AND "percent" <= 100)),
    CONSTRAINT "operating_costs_value_check" CHECK (("amount" IS NOT NULL) OR ("percent" IS NOT NULL))
);
CREATE INDEX "idx_operating_costs_type_active"
    ON "operating_costs"("type", "active");

CREATE TYPE "PricingScenarioOrdersSource" AS ENUM ('MANUAL', 'PREVIOUS_PERIOD');
CREATE TABLE "pricing_scenarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "orders_source" "PricingScenarioOrdersSource" NOT NULL DEFAULT 'MANUAL',
    "projected_orders" INTEGER NOT NULL DEFAULT 20,
    "average_items_per_order" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pricing_scenarios_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pricing_scenarios_period_check" CHECK ("period_end" > "period_start"),
    CONSTRAINT "pricing_scenarios_orders_check" CHECK ("projected_orders" >= 0),
    CONSTRAINT "pricing_scenarios_items_check" CHECK ("average_items_per_order" > 0)
);
CREATE INDEX "idx_pricing_scenarios_period"
    ON "pricing_scenarios"("period_start", "period_end");
CREATE INDEX "idx_pricing_scenarios_active_created"
    ON "pricing_scenarios"("active", "created_at");

INSERT INTO "payment_fee_schedules"
    ("provider", "product", "name", "settlement_days", "fee_percent", "vat_percent", "fixed_fee")
VALUES ('MERCADOPAGO', 'CHECKOUT_PRO', 'En el momento', 0, 6.29, 21.00, 0)
ON CONFLICT ("provider", "product", "settlement_days") DO NOTHING;

INSERT INTO "operating_costs" ("name", "type", "amount")
VALUES
    ('Depósito', 'FIXED_MONTHLY', 220000.00),
    ('Monotributo', 'FIXED_MONTHLY', 80000.00);

UPDATE "pricing_rule_sets" AS rules
SET
    "payment_fee_schedule_id" = fees."id",
    "payment_fee_percent" = fees."fee_percent",
    "payment_fee_vat_percent" = fees."vat_percent",
    "payment_fixed_cost" = fees."fixed_fee",
    "packaging_cost" = 1500.00,
    "subsidized_shipping_cost" = 3200.00
FROM "payment_fee_schedules" AS fees
WHERE fees."provider" = 'MERCADOPAGO'
  AND fees."product" = 'CHECKOUT_PRO'
  AND fees."settlement_days" = 0
  AND rules."status" IN ('ACTIVE', 'DRAFT');

INSERT INTO "pricing_scenarios"
    ("name", "period_start", "period_end", "orders_source", "projected_orders", "average_items_per_order")
VALUES
    ('Primer mes', date_trunc('month', CURRENT_TIMESTAMP), date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month', 'MANUAL', 20, 1)
ON CONFLICT DO NOTHING;
