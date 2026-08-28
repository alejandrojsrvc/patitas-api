ALTER TYPE "PaymentFeeProvider" ADD VALUE 'PAYWAY';

ALTER TABLE "payment_fee_schedules"
ADD COLUMN "vat_applies" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "pricing_rule_sets"
ADD COLUMN "payment_fee_vat_applies" BOOLEAN;

ALTER TABLE "pricing_scenarios"
ADD COLUMN "payment_fee_schedule_id" UUID;

CREATE INDEX "idx_pricing_scenarios_payment_fee_schedule"
ON "pricing_scenarios"("payment_fee_schedule_id");

ALTER TABLE "pricing_scenarios"
ADD CONSTRAINT "pricing_scenarios_payment_fee_schedule_fkey"
FOREIGN KEY ("payment_fee_schedule_id")
REFERENCES "payment_fee_schedules"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

UPDATE "pricing_rule_sets"
SET "payment_fee_vat_applies" = true
WHERE "payment_fee_vat_percent" IS NOT NULL;
