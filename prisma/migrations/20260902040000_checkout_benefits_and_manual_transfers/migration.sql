ALTER TYPE "PaymentAttemptStatus" ADD VALUE IF NOT EXISTS 'REPORTED';

CREATE TYPE "OrderBenefitType" AS ENUM (
  'SCHEDULED_PURCHASE',
  'COUPON',
  'AUTOMATIC_PROMOTION',
  'PAYMENT_METHOD',
  'SHIPPING',
  'CUSTOMER_CREDIT'
);

CREATE TYPE "OrderBenefitScope" AS ENUM (
  'PRODUCT',
  'ORDER',
  'PAYMENT',
  'SHIPPING'
);

CREATE TABLE "order_benefits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "type" "OrderBenefitType" NOT NULL,
  "scope" "OrderBenefitScope" NOT NULL,
  "origin" TEXT NOT NULL,
  "source_id" UUID,
  "source_code" TEXT,
  "description" TEXT NOT NULL,
  "percentage" DECIMAL(5,2),
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
  "metadata" JSONB,
  "claim_key" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_benefits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_benefits_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_benefits_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "order_benefits_percentage_check" CHECK ("percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100))
);

CREATE UNIQUE INDEX "order_benefits_claim_key_key" ON "order_benefits"("claim_key");
CREATE INDEX "idx_order_benefits_order_created" ON "order_benefits"("order_id", "created_at");
CREATE INDEX "idx_order_benefits_type_created" ON "order_benefits"("type", "created_at");

CREATE TABLE "purchase_schedule_configurations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "singleton_key" TEXT NOT NULL DEFAULT 'DEFAULT',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "lead_days" INTEGER NOT NULL DEFAULT 5,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_schedule_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_schedule_configurations_discount_check" CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100),
  CONSTRAINT "purchase_schedule_configurations_lead_days_check" CHECK ("lead_days" >= 0 AND "lead_days" <= 30)
);

CREATE UNIQUE INDEX "purchase_schedule_configurations_singleton_key_key"
  ON "purchase_schedule_configurations"("singleton_key");

INSERT INTO "purchase_schedule_configurations" ("singleton_key", "enabled", "discount_percent", "lead_days")
VALUES ('DEFAULT', true, 10, 5)
ON CONFLICT ("singleton_key") DO NOTHING;

CREATE TABLE "payment_method_benefit_configurations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_method" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "expiration_minutes" INTEGER NOT NULL DEFAULT 120,
  "instructions" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_method_benefit_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_method_benefit_configurations_discount_check" CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100),
  CONSTRAINT "payment_method_benefit_configurations_expiration_check" CHECK ("expiration_minutes" > 0)
);

CREATE UNIQUE INDEX "payment_method_benefit_configurations_payment_method_key"
  ON "payment_method_benefit_configurations"("payment_method");
CREATE INDEX "idx_payment_method_benefits_method_enabled"
  ON "payment_method_benefit_configurations"("payment_method", "enabled");

INSERT INTO "payment_method_benefit_configurations" ("payment_method", "enabled", "discount_percent", "expiration_minutes")
VALUES ('BANK_TRANSFER', false, 0, 120)
ON CONFLICT ("payment_method") DO NOTHING;

CREATE TRIGGER "purchase_schedule_configurations_updated_at" BEFORE UPDATE ON "purchase_schedule_configurations"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

CREATE TRIGGER "payment_method_benefit_configurations_updated_at" BEFORE UPDATE ON "payment_method_benefit_configurations"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

ALTER TABLE "payment_attempts"
  ADD COLUMN "reported_at" TIMESTAMPTZ(6),
  ADD COLUMN "reported_reference" TEXT,
  ADD COLUMN "proof_url" TEXT,
  ADD COLUMN "confirmed_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_payment_attempts_transfer_review"
  ON "payment_attempts"("provider", "status", "reported_at");
