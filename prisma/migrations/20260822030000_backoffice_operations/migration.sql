-- Backoffice lifecycle and manual order operations.
ALTER TABLE "supplier_offers"
    ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "OrderStatus" AS ENUM (
    'DRAFT', 'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'
);
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "InventoryMovementType" AS ENUM ('RESERVE', 'RELEASE', 'SHIP', 'ADJUSTMENT');

CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "full_name" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");
CREATE INDEX "idx_customers_email" ON "customers"("email");
CREATE INDEX "idx_customers_active" ON "customers"("active");
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "payment_method" TEXT,
    "payment_reference" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "shipping_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_email" VARCHAR(320) NOT NULL,
    "contact_phone" TEXT,
    "shipping_address" JSONB NOT NULL,
    "notes" TEXT,
    "tracking_number" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_amounts_check" CHECK ("subtotal" >= 0 AND "shipping_cost" >= 0 AND "total" >= 0)
);
CREATE INDEX "idx_orders_status_created" ON "orders"("status", "created_at");
CREATE INDEX "idx_orders_customer_id" ON "orders"("customer_id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "order_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "sku" TEXT,
    "presentation" TEXT,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_lines_quantity_check" CHECK ("quantity" > 0)
);
CREATE INDEX "idx_order_lines_order_id" ON "order_lines"("order_id");
CREATE INDEX "idx_order_lines_variant_id" ON "order_lines"("variant_id");
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "proof_url" TEXT,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_payments_amount_check" CHECK ("amount" > 0)
);
CREATE INDEX "idx_order_payments_order_created" ON "order_payments"("order_id", "created_at");
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "order_id" UUID,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_quantity_check" CHECK ("quantity" > 0)
);
CREATE INDEX "idx_inventory_moves_variant_created" ON "inventory_movements"("variant_id", "created_at");
CREATE INDEX "idx_inventory_moves_order_id" ON "inventory_movements"("order_id");
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER "customers_updated_at" BEFORE UPDATE ON "customers"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE TRIGGER "orders_updated_at" BEFORE UPDATE ON "orders"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_admin_audit_actor_created" ON "admin_audit_logs"("actor_user_id", "created_at");
CREATE INDEX "idx_admin_audit_created" ON "admin_audit_logs"("created_at");
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
