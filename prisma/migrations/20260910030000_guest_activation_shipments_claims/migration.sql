CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'PREPARING', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED');
CREATE TYPE "CustomerClaimType" AS ENUM ('ADDRESS_CHANGE', 'DELIVERY_DELAY', 'MISSING_PACKAGE', 'DAMAGED_PACKAGE', 'OTHER');
CREATE TYPE "CustomerClaimStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CANCELLED');

CREATE TABLE "shipments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
  "carrier" TEXT,
  "tracking_number" TEXT,
  "tracking_url" TEXT,
  "estimated_date" DATE,
  "estimated_slot" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");
CREATE INDEX "idx_shipments_status_updated" ON "shipments"("status", "updated_at");

CREATE TABLE "shipment_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shipment_id" UUID NOT NULL,
  "status" "ShipmentStatus" NOT NULL,
  "visible_message" TEXT NOT NULL,
  "actor_user_id" UUID,
  "metadata" JSONB,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shipment_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "shipment_events_shipment_status_key" ON "shipment_events"("shipment_id", "status");
CREATE INDEX "idx_shipment_events_shipment_occurred" ON "shipment_events"("shipment_id", "occurred_at");

CREATE TABLE "customer_claims" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "type" "CustomerClaimType" NOT NULL,
  "status" "CustomerClaimStatus" NOT NULL DEFAULT 'OPEN',
  "message" TEXT NOT NULL,
  "resolution" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_claims_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_claims_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_customer_claims_customer_created" ON "customer_claims"("customer_id", "created_at");
CREATE INDEX "idx_customer_claims_order_status" ON "customer_claims"("order_id", "status");

CREATE TABLE "guest_order_activation_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_order_activation_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "guest_order_activation_tokens_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "guest_activation_tokens_hash_key" ON "guest_order_activation_tokens"("token_hash");
CREATE INDEX "idx_guest_activation_tokens_order_consumed" ON "guest_order_activation_tokens"("order_id", "consumed_at");
CREATE INDEX "idx_guest_activation_tokens_expiry" ON "guest_order_activation_tokens"("expires_at", "consumed_at");
