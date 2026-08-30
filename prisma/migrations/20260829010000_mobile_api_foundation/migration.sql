ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;

ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'PUSH';

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "number" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'STORE',
  ADD COLUMN IF NOT EXISTS "delivery_instructions" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_number_key" ON "orders"("number");

ALTER TABLE "order_lines"
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'EXTRA',
  ADD COLUMN IF NOT EXISTS "pet_id" UUID,
  ADD COLUMN IF NOT EXISTS "plan_id" UUID,
  ADD COLUMN IF NOT EXISTS "image_url" TEXT;

ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'STORE';

ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'EXTRA',
  ADD COLUMN IF NOT EXISTS "pet_id" UUID,
  ADD COLUMN IF NOT EXISTS "plan_id" UUID;

ALTER TABLE "checkout_sessions"
  ADD COLUMN IF NOT EXISTS "delivery_instructions" TEXT,
  ADD COLUMN IF NOT EXISTS "saved_payment_method_id" UUID;

ALTER TABLE "replenishment_plans"
  ADD COLUMN IF NOT EXISTS "pet_id" UUID,
  ADD COLUMN IF NOT EXISTS "estimate_id" UUID,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "daily_grams_min" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "daily_grams_max" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "reminder_channels" "NotificationChannel"[] NOT NULL DEFAULT ARRAY['EMAIL']::"NotificationChannel"[],
  ADD COLUMN IF NOT EXISTS "bag_started_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "remaining_bucket" TEXT,
  ADD COLUMN IF NOT EXISTS "reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "lead_days" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "new_bag_pending" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "pets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "species" TEXT NOT NULL,
  "weight_kg" DECIMAL(8,2) NOT NULL,
  "life_stage" TEXT NOT NULL,
  "breed" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_pets_customer_created" ON "pets"("customer_id", "created_at");

CREATE TABLE IF NOT EXISTS "replenishment_estimates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID,
  "pet_id" UUID,
  "pet_name" TEXT NOT NULL,
  "pet_species" TEXT NOT NULL,
  "pet_weight_kg" DECIMAL(8,2) NOT NULL,
  "pet_life_stage" TEXT NOT NULL,
  "pet_breed" TEXT,
  "product_id" UUID,
  "variant_id" UUID,
  "custom_brand" TEXT,
  "custom_name" TEXT,
  "custom_weight_grams" INTEGER,
  "daily_grams_min" DECIMAL(12,2) NOT NULL,
  "daily_grams_max" DECIMAL(12,2) NOT NULL,
  "duration_days_min" DECIMAL(12,2) NOT NULL,
  "duration_days_max" DECIMAL(12,2) NOT NULL,
  "source" TEXT NOT NULL,
  "source_label" TEXT NOT NULL,
  "source_url" TEXT,
  "estimated_depletion_date" TIMESTAMPTZ(6) NOT NULL,
  "assumptions" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "replenishment_estimates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_replenishment_estimates_customer_created"
  ON "replenishment_estimates"("customer_id", "created_at");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'replenishment_estimates_customer_id_fkey') THEN
    ALTER TABLE "replenishment_estimates" ADD CONSTRAINT "replenishment_estimates_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'replenishment_estimates_pet_id_fkey') THEN
    ALTER TABLE "replenishment_estimates" ADD CONSTRAINT "replenishment_estimates_pet_id_fkey"
      FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'replenishment_estimates_product_id_fkey') THEN
    ALTER TABLE "replenishment_estimates" ADD CONSTRAINT "replenishment_estimates_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'replenishment_estimates_variant_id_fkey') THEN
    ALTER TABLE "replenishment_estimates" ADD CONSTRAINT "replenishment_estimates_variant_id_fkey"
      FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "replenishment_plans_estimate_id_key"
  ON "replenishment_plans"("estimate_id");
CREATE UNIQUE INDEX IF NOT EXISTS "replenishment_plans_idempotency_key_key"
  ON "replenishment_plans"("idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_replenishment_plans_pet_id" ON "replenishment_plans"("pet_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'replenishment_plans_pet_id_fkey') THEN
    ALTER TABLE "replenishment_plans" ADD CONSTRAINT "replenishment_plans_pet_id_fkey"
      FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'replenishment_plans_estimate_id_fkey') THEN
    ALTER TABLE "replenishment_plans" ADD CONSTRAINT "replenishment_plans_estimate_id_fkey"
      FOREIGN KEY ("estimate_id") REFERENCES "replenishment_estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "pet_breeds" (
  "id" VARCHAR(80) NOT NULL,
  "species" VARCHAR(20) NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "pet_breeds_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_pet_breeds_species_active_order" ON "pet_breeds"("species", "active", "sort_order");

INSERT INTO "pet_breeds" ("id", "species", "name", "sort_order", "updated_at") VALUES
  ('mixed', 'all', 'Mestizo', 900, CURRENT_TIMESTAMP),
  ('unknown', 'all', 'No sé', 901, CURRENT_TIMESTAMP),
  ('labrador-retriever', 'dog', 'Labrador retriever', 10, CURRENT_TIMESTAMP),
  ('golden-retriever', 'dog', 'Golden retriever', 20, CURRENT_TIMESTAMP),
  ('french-bulldog', 'dog', 'Bulldog francés', 30, CURRENT_TIMESTAMP),
  ('german-shepherd', 'dog', 'Pastor alemán', 40, CURRENT_TIMESTAMP),
  ('poodle', 'dog', 'Caniche', 50, CURRENT_TIMESTAMP),
  ('beagle', 'dog', 'Beagle', 60, CURRENT_TIMESTAMP),
  ('siamese', 'cat', 'Siamés', 10, CURRENT_TIMESTAMP),
  ('persian', 'cat', 'Persa', 20, CURRENT_TIMESTAMP),
  ('maine-coon', 'cat', 'Maine coon', 30, CURRENT_TIMESTAMP),
  ('bengal', 'cat', 'Bengalí', 40, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "breed_id" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "sex" TEXT,
  ADD COLUMN IF NOT EXISTS "birth_date" DATE,
  ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
CREATE INDEX IF NOT EXISTS "idx_pets_breed_id" ON "pets"("breed_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_breed_id_fkey') THEN
    ALTER TABLE "pets" ADD CONSTRAINT "pets_breed_id_fkey"
      FOREIGN KEY ("breed_id") REFERENCES "pet_breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE "customer_notification_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "push" BOOLEAN NOT NULL DEFAULT false,
  "email" BOOLEAN NOT NULL DEFAULT true,
  "whatsapp" BOOLEAN NOT NULL DEFAULT false,
  "order_updates" BOOLEAN NOT NULL DEFAULT true,
  "replenishment_reminders" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customer_notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_notification_preferences_customer_id_key" UNIQUE ("customer_id"),
  CONSTRAINT "customer_notification_preferences_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "device_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'EXPO',
  "device_id_hash" TEXT,
  "app_version" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_tokens_customer_token_key" UNIQUE ("customer_id", "token"),
  CONSTRAINT "device_tokens_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_device_tokens_customer_active" ON "device_tokens"("customer_id", "active");
CREATE INDEX IF NOT EXISTS "idx_device_tokens_customer_device" ON "device_tokens"("customer_id", "device_id_hash");

CREATE TABLE IF NOT EXISTS "saved_payment_methods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "brand" TEXT,
  "last_four" VARCHAR(4),
  "expiration_month" INTEGER,
  "expiration_year" INTEGER,
  "provider_payment_method_id" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_payment_methods_provider_external_key" ON "saved_payment_methods"("provider", "provider_payment_method_id");
CREATE INDEX IF NOT EXISTS "idx_saved_payment_methods_customer_active" ON "saved_payment_methods"("customer_id", "active");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_payment_methods_customer_id_fkey') THEN
    ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkout_sessions_saved_payment_method_id_fkey') THEN
    ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_saved_payment_method_id_fkey"
      FOREIGN KEY ("saved_payment_method_id") REFERENCES "saved_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "in_app_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_in_app_notifications_customer_read_created" ON "in_app_notifications"("customer_id", "read_at", "created_at");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'in_app_notifications_customer_id_fkey') THEN
    ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "mobile_access_daily" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "access_date" DATE NOT NULL,
  "device_id_hash" TEXT NOT NULL,
  "platform" TEXT,
  "app_version" TEXT,
  "role" "UserRole" NOT NULL,
  "access_count" INTEGER NOT NULL DEFAULT 1,
  "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_access_daily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mobile_access_daily_user_date_device_key" ON "mobile_access_daily"("user_id", "access_date", "device_id_hash");
CREATE INDEX IF NOT EXISTS "idx_mobile_access_daily_date_platform" ON "mobile_access_daily"("access_date", "platform");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mobile_access_daily_user_id_fkey') THEN
    ALTER TABLE "mobile_access_daily" ADD CONSTRAINT "mobile_access_daily_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "order_status_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_order_status_events_order_occurred" ON "order_status_events"("order_id", "occurred_at");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_status_events_order_id_fkey') THEN
    ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_pet_id_fkey') THEN
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_pet_id_fkey"
      FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_plan_id_fkey') THEN
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "replenishment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_lines_pet_id_fkey') THEN
    ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_pet_id_fkey"
      FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_lines_plan_id_fkey') THEN
    ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "replenishment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
