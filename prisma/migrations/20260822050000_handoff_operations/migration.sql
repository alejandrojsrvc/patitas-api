-- Operational handoff: replenishment, payments, shipping coverage, consent,
-- notifications, marketing attribution and referrals.
CREATE TYPE "PromotionKind" AS ENUM ('DISCOUNT', 'BUNDLE');
CREATE TYPE "ReplenishmentPlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'CONVERTED', 'FAILED', 'CANCELLED');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED');
CREATE TYPE "ShippingCoverageType" AS ENUM ('POSTAL_CODE', 'NEIGHBORHOOD', 'POLYGON');
CREATE TYPE "MarketingEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "ReferralLedgerEntryType" AS ENUM ('CREDIT', 'DEBIT', 'REVERSAL');

ALTER TABLE "promotions" ADD COLUMN "kind" "PromotionKind" NOT NULL DEFAULT 'DISCOUNT';
ALTER TABLE "orders"
    ADD COLUMN "payment_provider" TEXT,
    ADD COLUMN "payment_external_id" TEXT,
    ADD COLUMN "payment_expires_at" TIMESTAMPTZ,
    ADD COLUMN "shipping_zone_id" UUID,
    ADD COLUMN "shipping_estimate" TEXT,
    ADD COLUMN "utm_source" TEXT,
    ADD COLUMN "utm_medium" TEXT,
    ADD COLUMN "utm_campaign" TEXT,
    ADD COLUMN "utm_content" TEXT,
    ADD COLUMN "initial_landing" TEXT,
    ADD COLUMN "anonymous_visitor_hash" TEXT;
ALTER TABLE "carts"
    ADD COLUMN "source_plan_id" UUID,
    ADD COLUMN "utm_source" TEXT,
    ADD COLUMN "utm_medium" TEXT,
    ADD COLUMN "utm_campaign" TEXT,
    ADD COLUMN "utm_content" TEXT,
    ADD COLUMN "initial_landing" TEXT,
    ADD COLUMN "anonymous_visitor_hash" TEXT;
ALTER TABLE "checkout_sessions"
    ADD COLUMN "shipping_zone_id" UUID,
    ADD COLUMN "shipping_estimate" TEXT;

CREATE TABLE "promotion_bundle_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promotion_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "promotion_bundle_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "promotion_bundle_items_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "promotion_bundle_items_promotion_variant_key"
    ON "promotion_bundle_items"("promotion_id", "variant_id");
CREATE INDEX "idx_promotion_bundle_items_variant_id"
    ON "promotion_bundle_items"("variant_id");
ALTER TABLE "promotion_bundle_items" ADD CONSTRAINT "promotion_bundle_items_promotion_id_fkey"
    FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_bundle_items" ADD CONSTRAINT "promotion_bundle_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "shipping_zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "coverage_type" "ShippingCoverageType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "postal_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "neighborhoods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "polygon" JSONB,
    "cost" DECIMAL(14,2) NOT NULL,
    "free_shipping_from" DECIMAL(14,2),
    "max_weight_grams" INTEGER,
    "estimated_days_min" INTEGER NOT NULL,
    "estimated_days_max" INTEGER NOT NULL,
    "delivery_windows" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipping_zones_cost_check" CHECK ("cost" >= 0),
    CONSTRAINT "shipping_zones_days_check" CHECK ("estimated_days_min" >= 0 AND "estimated_days_max" >= "estimated_days_min"),
    CONSTRAINT "shipping_zones_weight_check" CHECK ("max_weight_grams" IS NULL OR "max_weight_grams" > 0)
);
CREATE INDEX "idx_shipping_zones_active_priority" ON "shipping_zones"("active", "priority");

CREATE TABLE "replenishment_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "order_id" UUID,
    "guest_access_token_hash" TEXT,
    "pet_name" TEXT NOT NULL,
    "pet_species" TEXT NOT NULL,
    "pet_weight_kg" DECIMAL(8,2) NOT NULL,
    "pet_life_stage" TEXT NOT NULL,
    "pet_breed" TEXT,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "sku_snapshot" TEXT,
    "presentation_snapshot" TEXT,
    "daily_consumption" DECIMAL(12,2) NOT NULL,
    "consumption_unit" TEXT NOT NULL,
    "duration_days_min" INTEGER NOT NULL,
    "duration_days_max" INTEGER NOT NULL,
    "calculation_source" TEXT NOT NULL,
    "estimated_depletion_date" DATE NOT NULL,
    "next_reminder_at" TIMESTAMPTZ,
    "channel" "NotificationChannel" NOT NULL,
    "consent_at" TIMESTAMPTZ NOT NULL,
    "consent_version" TEXT NOT NULL,
    "unsubscribed_at" TIMESTAMPTZ,
    "status" "ReplenishmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "review_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "replenishment_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "replenishment_plans_weight_check" CHECK ("pet_weight_kg" > 0),
    CONSTRAINT "replenishment_plans_consumption_check" CHECK ("daily_consumption" > 0),
    CONSTRAINT "replenishment_plans_duration_check" CHECK ("duration_days_min" > 0 AND "duration_days_max" >= "duration_days_min")
);
CREATE INDEX "idx_replenishment_plans_customer_status" ON "replenishment_plans"("customer_id", "status");
CREATE INDEX "idx_replenishment_plans_reminder" ON "replenishment_plans"("status", "next_reminder_at");
CREATE INDEX "idx_replenishment_plans_guest_token" ON "replenishment_plans"("guest_access_token_hash");
ALTER TABLE "replenishment_plans" ADD CONSTRAINT "replenishment_plans_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "replenishment_plans" ADD CONSTRAINT "replenishment_plans_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "replenishment_plans" ADD CONSTRAINT "replenishment_plans_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_plans" ADD CONSTRAINT "replenishment_plans_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_preference_id" TEXT,
    "external_payment_id" TEXT,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "payment_url" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "raw_response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_attempts_amount_check" CHECK ("amount" >= 0)
);
CREATE UNIQUE INDEX "payment_attempts_idempotency_key_key" ON "payment_attempts"("idempotency_key");
CREATE INDEX "idx_payment_attempts_order_created" ON "payment_attempts"("order_id", "created_at");
CREATE INDEX "idx_payment_attempts_provider_payment" ON "payment_attempts"("provider", "external_payment_id");
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_webhook_events_provider_external_key" ON "payment_webhook_events"("provider", "external_id");
CREATE INDEX "idx_payment_webhook_events_status_created" ON "payment_webhook_events"("status", "created_at");

CREATE TABLE "communication_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "guest_token_hash" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "destination" TEXT NOT NULL,
    "consent_at" TIMESTAMPTZ NOT NULL,
    "version" TEXT NOT NULL,
    "unsubscribed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "communication_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_communication_consents_customer_channel" ON "communication_consents"("customer_id", "channel");
CREATE INDEX "idx_communication_consents_guest_channel" ON "communication_consents"("guest_token_hash", "channel");
ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "destination_hash" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "responded_at" TIMESTAMPTZ,
    "converted_at" TIMESTAMPTZ,
    "error" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "customer_id" UUID,
    "order_id" UUID,
    "cart_id" UUID,
    "checkout_session_id" UUID,
    "plan_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key_key" ON "notification_deliveries"("idempotency_key");
CREATE INDEX "idx_notification_deliveries_status_attempt" ON "notification_deliveries"("status", "next_attempt_at");
CREATE INDEX "idx_notification_deliveries_plan_created" ON "notification_deliveries"("plan_id", "created_at");
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_checkout_session_id_fkey" FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "replenishment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "marketing_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_name" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "MarketingEventStatus" NOT NULL DEFAULT 'PENDING',
    "visitor_hash" TEXT,
    "value" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "payload" JSONB,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "initial_landing" TEXT,
    "customer_id" UUID,
    "cart_id" UUID,
    "checkout_session_id" UUID,
    "order_id" UUID,
    "sent_at" TIMESTAMPTZ,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "marketing_events_name_event_key" ON "marketing_events"("event_name", "event_id");
CREATE INDEX "idx_marketing_events_status_created" ON "marketing_events"("status", "created_at");
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_checkout_session_id_fkey" FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "referral_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reward_type" "PromotionType" NOT NULL,
    "reward_value" DECIMAL(14,2) NOT NULL,
    "minimum_subtotal" DECIMAL(14,2),
    "first_order_only" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "referral_campaigns_reward_check" CHECK ("reward_value" >= 0)
);
CREATE TABLE "referral_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "referrer_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");
CREATE INDEX "idx_referral_codes_referrer_active" ON "referral_codes"("referrer_id", "active");
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "referral_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "referral_attributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_code_id" UUID NOT NULL,
    "referred_id" UUID NOT NULL,
    "order_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_attributions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "referral_attributions_order_id_key" ON "referral_attributions"("order_id");
CREATE UNIQUE INDEX "referral_attributions_code_referred_key" ON "referral_attributions"("referral_code_id", "referred_id");
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "referral_ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "referral_code_id" UUID,
    "order_id" UUID,
    "type" "ReferralLedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "reversed_entry_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_ledger_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "referral_ledger_entries_amount_check" CHECK ("amount" >= 0)
);
CREATE UNIQUE INDEX "referral_ledger_entries_reversed_entry_id_key" ON "referral_ledger_entries"("reversed_entry_id");
CREATE INDEX "idx_referral_ledger_customer_expiry" ON "referral_ledger_entries"("customer_id", "expires_at");
ALTER TABLE "referral_ledger_entries" ADD CONSTRAINT "referral_ledger_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referral_ledger_entries" ADD CONSTRAINT "referral_ledger_entries_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "referral_ledger_entries" ADD CONSTRAINT "referral_ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "referral_ledger_entries" ADD CONSTRAINT "referral_ledger_entries_reversed_entry_id_fkey" FOREIGN KEY ("reversed_entry_id") REFERENCES "referral_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_zone_id_fkey"
    FOREIGN KEY ("shipping_zone_id") REFERENCES "shipping_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_source_plan_id_fkey"
    FOREIGN KEY ("source_plan_id") REFERENCES "replenishment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_shipping_zone_id_fkey"
    FOREIGN KEY ("shipping_zone_id") REFERENCES "shipping_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER "shipping_zones_updated_at" BEFORE UPDATE ON "shipping_zones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "replenishment_plans_updated_at" BEFORE UPDATE ON "replenishment_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "payment_attempts_updated_at" BEFORE UPDATE ON "payment_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "communication_consents_updated_at" BEFORE UPDATE ON "communication_consents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "notification_deliveries_updated_at" BEFORE UPDATE ON "notification_deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "referral_campaigns_updated_at" BEFORE UPDATE ON "referral_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
