UPDATE "payment_provider_configurations"
SET "enabled" = false,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "provider" = 'SIMULATED';
