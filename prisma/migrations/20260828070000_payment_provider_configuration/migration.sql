CREATE TYPE "PaymentProviderConfigurationName" AS ENUM (
    'SIMULATED',
    'MERCADO_PAGO',
    'PAYWAY'
);

CREATE TABLE "payment_provider_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "PaymentProviderConfigurationName" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_provider_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_provider_configurations_provider_key"
    ON "payment_provider_configurations"("provider");

CREATE INDEX "idx_payment_provider_configurations_enabled_priority"
    ON "payment_provider_configurations"("enabled", "priority");

INSERT INTO "payment_provider_configurations"
    ("provider", "enabled", "priority")
VALUES
    ('SIMULATED', true, 0),
    ('MERCADO_PAGO', true, 10),
    ('PAYWAY', false, 5)
ON CONFLICT ("provider") DO NOTHING;
