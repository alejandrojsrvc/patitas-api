DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentRefundStatus') THEN
        CREATE TYPE "PaymentRefundStatus" AS ENUM ('PROCESSING', 'REFUNDED', 'FAILED');
    END IF;
END $$;

ALTER TABLE "orders"
    ADD COLUMN IF NOT EXISTS "reservation_expires_at" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "reservation_released_at" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "reconciliation_required" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "reconciliation_reason" TEXT;

CREATE TABLE IF NOT EXISTS "payment_refunds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_attempt_id" UUID,
    "provider" TEXT NOT NULL,
    "external_payment_id" TEXT NOT NULL,
    "external_operation_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PROCESSING',
    "failure_reason" TEXT,
    "raw_response" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_order_id_fkey'
    ) THEN
        ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_order_id_fkey"
            FOREIGN KEY ("order_id") REFERENCES "orders"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_payment_attempt_id_fkey'
    ) THEN
        ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_attempt_id_fkey"
            FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_idempotency_key_key"
    ON "payment_refunds"("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_external_operation_id_key"
    ON "payment_refunds"("external_operation_id")
    WHERE "external_operation_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_payment_refunds_order_created"
    ON "payment_refunds"("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_payment_refunds_status_created"
    ON "payment_refunds"("status", "created_at");

CREATE TABLE IF NOT EXISTS "checkout_handoffs" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checkout_handoffs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "checkout_handoffs_token_hash_key"
    ON "checkout_handoffs"("token_hash");
CREATE INDEX IF NOT EXISTS "idx_checkout_handoffs_cart_id"
    ON "checkout_handoffs"("cart_id");
CREATE INDEX IF NOT EXISTS "idx_checkout_handoffs_expiry"
    ON "checkout_handoffs"("expires_at", "consumed_at");
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'checkout_handoffs_cart_id_fkey'
    ) THEN
        ALTER TABLE "checkout_handoffs" ADD CONSTRAINT "checkout_handoffs_cart_id_fkey"
            FOREIGN KEY ("cart_id") REFERENCES "carts"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
