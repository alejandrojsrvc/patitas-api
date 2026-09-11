INSERT INTO "payment_provider_configurations" ("provider", "enabled", "priority")
VALUES ('PAYWAY', true, 5)
ON CONFLICT ("provider") DO UPDATE
SET "enabled" = true,
    "priority" = EXCLUDED."priority",
    "updated_at" = CURRENT_TIMESTAMP;
