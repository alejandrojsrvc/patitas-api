-- Customer storefront, carts, checkout, promotions and product analytics.
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'ABANDONED', 'CONVERTED', 'EXPIRED');
CREATE TYPE "CheckoutStage" AS ENUM ('CONTACT', 'SHIPPING', 'PAYMENT', 'CONFIRMATION');
CREATE TYPE "CheckoutStatus" AS ENUM ('DRAFT', 'COMPLETED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED');

ALTER TABLE "orders"
    ADD COLUMN "discount_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "coupon_code" TEXT,
    ADD COLUMN "shipping_option_id" UUID,
    ADD COLUMN "shipping_method" TEXT,
    ADD COLUMN "public_access_token_hash" TEXT;
CREATE UNIQUE INDEX "orders_public_access_token_key"
    ON "orders"("public_access_token_hash");

CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "phone" TEXT,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "apartment" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "reference" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_customer_addresses_default"
    ON "customer_addresses"("customer_id", "is_default");
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "shipping_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipping_options_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipping_options_cost_check" CHECK ("cost" >= 0)
);
CREATE INDEX "idx_shipping_options_active_order"
    ON "shipping_options"("active", "display_order");

CREATE TABLE "carts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "anonymous_token_hash" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abandoned_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "converted_order_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "carts_anonymous_token_key" ON "carts"("anonymous_token_hash");
CREATE UNIQUE INDEX "carts_converted_order_key" ON "carts"("converted_order_id");
CREATE INDEX "idx_carts_customer_status" ON "carts"("customer_id", "status");
CREATE INDEX "idx_carts_status_activity" ON "carts"("status", "last_activity_at");
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_converted_order_id_fkey"
    FOREIGN KEY ("converted_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "cart_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "cart_items_cart_variant_key" ON "cart_items"("cart_id", "variant_id");
CREATE INDEX "idx_cart_items_variant_id" ON "cart_items"("variant_id");
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey"
    FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "minimum_subtotal" DECIMAL(14,2),
    "max_redemptions" INTEGER,
    "redemption_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "promotions_value_check" CHECK ("value" >= 0),
    CONSTRAINT "promotions_percentage_check" CHECK ("type" <> 'PERCENTAGE' OR "value" <= 100)
);
CREATE INDEX "idx_promotions_active_period"
    ON "promotions"("active", "starts_at", "ends_at", "priority");

CREATE TABLE "promotion_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promotion_id" UUID NOT NULL,
    "product_id" UUID,
    "variant_id" UUID,
    "category_id" UUID,
    "brand_id" UUID,
    CONSTRAINT "promotion_targets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_promotion_targets_promotion_id" ON "promotion_targets"("promotion_id");
CREATE INDEX "idx_promotion_targets_product_id" ON "promotion_targets"("product_id");
CREATE INDEX "idx_promotion_targets_variant_id" ON "promotion_targets"("variant_id");
CREATE INDEX "idx_promotion_targets_category_id" ON "promotion_targets"("category_id");
CREATE INDEX "idx_promotion_targets_brand_id" ON "promotion_targets"("brand_id");
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_promotion_id_fkey"
    FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_brand_id_fkey"
    FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promotion_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "max_redemptions" INTEGER,
    "redemption_count" INTEGER NOT NULL DEFAULT 0,
    "per_customer_limit" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "idx_coupons_active_period" ON "coupons"("active", "starts_at", "ends_at");
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_promotion_id_fkey"
    FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "checkout_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cart_id" UUID NOT NULL,
    "customer_id" UUID,
    "access_token_hash" TEXT NOT NULL,
    "stage" "CheckoutStage" NOT NULL DEFAULT 'CONTACT',
    "status" "CheckoutStatus" NOT NULL DEFAULT 'DRAFT',
    "contact_name" TEXT,
    "contact_email" VARCHAR(320),
    "contact_phone" TEXT,
    "shipping_address" JSONB,
    "shipping_option_id" UUID,
    "shipping_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payment_method" TEXT,
    "coupon_id" UUID,
    "order_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "checkout_sessions_cart_key" ON "checkout_sessions"("cart_id");
CREATE UNIQUE INDEX "checkout_sessions_access_token_key" ON "checkout_sessions"("access_token_hash");
CREATE UNIQUE INDEX "checkout_sessions_order_key" ON "checkout_sessions"("order_id");
CREATE INDEX "idx_checkout_sessions_status_expiry" ON "checkout_sessions"("status", "expires_at");
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_cart_id_fkey"
    FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_shipping_option_id_fkey"
    FOREIGN KEY ("shipping_option_id") REFERENCES "shipping_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coupon_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "coupon_redemptions_coupon_order_key" ON "coupon_redemptions"("coupon_id", "order_id");
CREATE INDEX "idx_coupon_redemptions_customer" ON "coupon_redemptions"("coupon_id", "customer_id");
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_option_id_fkey"
    FOREIGN KEY ("shipping_option_id") REFERENCES "shipping_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "product_view_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "view_date" DATE NOT NULL,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "unique_views" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_view_daily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_view_daily_product_date_key" ON "product_view_daily"("product_id", "view_date");
CREATE INDEX "idx_product_view_daily_date" ON "product_view_daily"("view_date");
ALTER TABLE "product_view_daily" ADD CONSTRAINT "product_view_daily_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "product_view_visitor_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "view_date" DATE NOT NULL,
    "visitor_hash" TEXT NOT NULL,
    "last_viewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_view_visitor_daily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_view_visitor_daily_key"
    ON "product_view_visitor_daily"("product_id", "view_date", "visitor_hash");
CREATE INDEX "idx_product_view_visitor_daily_product_date"
    ON "product_view_visitor_daily"("product_id", "view_date");
ALTER TABLE "product_view_visitor_daily" ADD CONSTRAINT "product_view_visitor_daily_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "recent_product_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "viewer_key" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "customer_id" UUID,
    "last_viewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recent_product_views_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "recent_product_views_viewer_product_key"
    ON "recent_product_views"("viewer_key", "product_id");
CREATE INDEX "idx_recent_product_views_viewer_date"
    ON "recent_product_views"("viewer_key", "last_viewed_at");
ALTER TABLE "recent_product_views" ADD CONSTRAINT "recent_product_views_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recent_product_views" ADD CONSTRAINT "recent_product_views_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER "customer_addresses_updated_at" BEFORE UPDATE ON "customer_addresses"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "shipping_options_updated_at" BEFORE UPDATE ON "shipping_options"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "carts_updated_at" BEFORE UPDATE ON "carts"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "cart_items_updated_at" BEFORE UPDATE ON "cart_items"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "promotions_updated_at" BEFORE UPDATE ON "promotions"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "coupons_updated_at" BEFORE UPDATE ON "coupons"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "checkout_sessions_updated_at" BEFORE UPDATE ON "checkout_sessions"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
