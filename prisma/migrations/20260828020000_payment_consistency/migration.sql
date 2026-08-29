ALTER TABLE "order_payments"
    ADD COLUMN "payment_attempt_id" UUID,
    ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    ADD COLUMN "kind" "OrderPaymentKind" NOT NULL DEFAULT 'PAYMENT',
    ADD COLUMN "provider" TEXT,
    ADD COLUMN "external_payment_id" TEXT,
    ADD COLUMN "external_operation_id" TEXT;

ALTER TABLE "payment_attempts"
    ADD COLUMN "external_reference" TEXT,
    ADD COLUMN "processing_lease_until" TIMESTAMPTZ,
    ADD COLUMN "processing_lease_token" TEXT,
    ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "last_error" TEXT,
    ADD COLUMN "request_fingerprint" TEXT NOT NULL DEFAULT '';

ALTER TABLE "payment_webhook_events"
    ADD COLUMN "external_payment_id" TEXT,
    ADD COLUMN "external_reference" TEXT,
    ADD COLUMN "payment_attempt_id" UUID,
    ADD COLUMN "processing_started_at" TIMESTAMPTZ,
    ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "reconciliation_required" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN "reconciliation_reason" TEXT;

ALTER TABLE "payment_webhook_events" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payment_webhook_events"
    ALTER COLUMN "status" TYPE "PaymentWebhookEventStatus"
    USING CASE
        WHEN "status" IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED')
            THEN "status"::"PaymentWebhookEventStatus"
        ELSE 'FAILED'::"PaymentWebhookEventStatus"
    END;
ALTER TABLE "payment_webhook_events"
    ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_payment_attempt_id_fkey"
    FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_attempt_id_fkey"
    FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "payment_attempts"
        WHERE "status" IN ('CREATED', 'PROCESSING', 'PENDING')
        GROUP BY "order_id", "provider"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'No se puede crear el índice de intentos activos: existen duplicados.';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM "payment_attempts"
        WHERE "external_payment_id" IS NOT NULL
        GROUP BY "provider", "external_payment_id"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'No se puede crear el índice de pagos externos: existen duplicados.';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM "order_payments"
        WHERE "kind" = 'PAYMENT'
          AND "provider" IS NOT NULL
          AND "external_payment_id" IS NOT NULL
        GROUP BY "provider", "external_payment_id"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'No se puede crear el índice de capturas: existen duplicados.';
    END IF;
END $$;

CREATE UNIQUE INDEX "payment_attempts_provider_external_payment_key"
    ON "payment_attempts"("provider", "external_payment_id")
    WHERE "external_payment_id" IS NOT NULL;
CREATE UNIQUE INDEX "payment_attempts_provider_external_reference_key"
    ON "payment_attempts"("provider", "external_reference")
    WHERE "external_reference" IS NOT NULL;
CREATE UNIQUE INDEX "payment_attempts_one_active_per_order_provider_key"
    ON "payment_attempts"("order_id", "provider")
    WHERE "status" IN ('CREATED', 'PROCESSING', 'PENDING');
CREATE UNIQUE INDEX "order_payments_capture_external_key"
    ON "order_payments"("provider", "external_payment_id")
    WHERE "kind" = 'PAYMENT'
      AND "provider" IS NOT NULL
      AND "external_payment_id" IS NOT NULL;
CREATE UNIQUE INDEX "order_payments_external_operation_key"
    ON "order_payments"("provider", "external_operation_id")
    WHERE "external_operation_id" IS NOT NULL;
CREATE INDEX "idx_payment_attempts_processing_lease"
    ON "payment_attempts"("status", "processing_lease_until");
CREATE INDEX "idx_payment_webhook_events_retry"
    ON "payment_webhook_events"("status", "processing_started_at", "created_at");
CREATE INDEX "idx_payment_webhook_events_attempt_created"
    ON "payment_webhook_events"("payment_attempt_id", "created_at");
CREATE INDEX "idx_order_payments_attempt_created"
    ON "order_payments"("payment_attempt_id", "created_at");
