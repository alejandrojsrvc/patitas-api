/*
  Warnings:

  - You are about to alter the column `estimated_daily_grams_per_kg` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.

*/
-- DropForeignKey
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_product_id_fkey";

-- AlterTable
ALTER TABLE "admin_audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "brands" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cart_items" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "carts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "checkout_sessions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "communication_consents" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "coupon_redemptions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "coupons" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_addresses" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "feeding_guide_entries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "feeding_guides" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_movements" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "marketing_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_deliveries" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "order_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "order_payments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_attempts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_webhook_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pricing_reviews" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pricing_rule_sets" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_media" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_source_snapshots" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_variants" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_view_daily" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_view_visitor_daily" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "estimated_daily_grams_per_kg" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "promotion_bundle_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "promotion_targets" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "promotions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recent_product_views" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "referral_attributions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "referral_campaigns" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "referral_codes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "referral_ledger_entries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "replenishment_plans" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "retail_price_observations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "shipping_options" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "shipping_zones" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "supplier_offers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "id" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "product_media" RENAME CONSTRAINT "product_media_variant_product_fkey" TO "product_media_variant_id_product_id_fkey";

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "checkout_sessions_cart_key" RENAME TO "checkout_sessions_cart_id_key";
