-- Public calculator reminders are separate from purchasable replenishment plans.
-- This keeps custom-food and anonymous reminders from weakening product FKs.
ALTER TABLE "replenishment_estimates"
  ADD COLUMN "guest_access_token_hash" TEXT;

CREATE INDEX "idx_replenishment_estimates_guest_token"
  ON "replenishment_estimates"("guest_access_token_hash");

CREATE TYPE "ReplenishmentReminderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

CREATE TABLE "replenishment_reminders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID,
  "guest_access_token_hash" TEXT,
  "estimate_id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "consent_at" TIMESTAMPTZ(6) NOT NULL,
  "consent_version" TEXT NOT NULL,
  "next_reminder_at" TIMESTAMPTZ(6) NOT NULL,
  "status" "ReplenishmentReminderStatus" NOT NULL DEFAULT 'ACTIVE',
  "unsubscribed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "replenishment_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_replenishment_reminders_customer_status"
  ON "replenishment_reminders"("customer_id", "status");
CREATE INDEX "idx_replenishment_reminders_guest_token"
  ON "replenishment_reminders"("guest_access_token_hash");
CREATE INDEX "idx_replenishment_reminders_due"
  ON "replenishment_reminders"("status", "next_reminder_at");

ALTER TABLE "replenishment_reminders"
  ADD CONSTRAINT "replenishment_reminders_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "replenishment_reminders"
  ADD CONSTRAINT "replenishment_reminders_estimate_id_fkey"
  FOREIGN KEY ("estimate_id") REFERENCES "replenishment_estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries"
  ADD COLUMN "replenishment_reminder_id" UUID;
CREATE INDEX "idx_notification_deliveries_reminder_created"
  ON "notification_deliveries"("replenishment_reminder_id", "created_at");
ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_replenishment_reminder_id_fkey"
  FOREIGN KEY ("replenishment_reminder_id") REFERENCES "replenishment_reminders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER "replenishment_reminders_updated_at" BEFORE UPDATE ON "replenishment_reminders"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
