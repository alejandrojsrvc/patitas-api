CREATE TYPE "PurchaseScheduleStatus" AS ENUM (
  'DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'AWAITING_CONFIRMATION', 'PAUSED', 'CANCELLED'
);

CREATE TABLE "purchase_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "checkout_session_id" UUID,
  "initial_order_id" UUID,
  "order_line_id" UUID,
  "variant_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "frequency_days" INTEGER NOT NULL,
  "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "lead_days" INTEGER NOT NULL DEFAULT 5,
  "status" "PurchaseScheduleStatus" NOT NULL DEFAULT 'DRAFT',
  "next_order_at" TIMESTAMPTZ(6),
  "next_reminder_at" TIMESTAMPTZ(6),
  "last_confirmed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_schedules_frequency_check" CHECK ("frequency_days" IN (7, 14, 21, 30)),
  CONSTRAINT "purchase_schedules_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "purchase_schedules_discount_check" CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100),
  CONSTRAINT "purchase_schedules_lead_days_check" CHECK ("lead_days" >= 0 AND "lead_days" <= 30)
);

CREATE UNIQUE INDEX "purchase_schedules_checkout_session_id_key" ON "purchase_schedules"("checkout_session_id");
CREATE UNIQUE INDEX "purchase_schedules_initial_order_id_key" ON "purchase_schedules"("initial_order_id");
CREATE UNIQUE INDEX "purchase_schedules_order_line_id_key" ON "purchase_schedules"("order_line_id");
CREATE INDEX "idx_purchase_schedules_customer_status" ON "purchase_schedules"("customer_id", "status");
CREATE INDEX "idx_purchase_schedules_reminder" ON "purchase_schedules"("status", "next_reminder_at");

ALTER TABLE "purchase_schedules"
  ADD CONSTRAINT "purchase_schedules_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_schedules"
  ADD CONSTRAINT "purchase_schedules_checkout_session_id_fkey"
  FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_schedules"
  ADD CONSTRAINT "purchase_schedules_initial_order_id_fkey"
  FOREIGN KEY ("initial_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_schedules"
  ADD CONSTRAINT "purchase_schedules_order_line_id_fkey"
  FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_schedules"
  ADD CONSTRAINT "purchase_schedules_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "purchase_schedules_updated_at" BEFORE UPDATE ON "purchase_schedules"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
