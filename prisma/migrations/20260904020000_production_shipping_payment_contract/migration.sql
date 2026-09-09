CREATE TYPE "ShippingOperatingRegion" AS ENUM ('AMBA', 'CABA');

ALTER TABLE "shipping_zones"
    ADD COLUMN "region" "ShippingOperatingRegion" NOT NULL DEFAULT 'AMBA';

UPDATE "shipping_zones"
SET "region" = 'CABA'
WHERE "id" = '00000000-0000-4000-8000-000000000411';

UPDATE "shipping_zones"
SET "name" = 'Nuevas zonas / Cordón 3'
WHERE "id" = '00000000-0000-4000-8000-000000000414';

UPDATE "shipping_zones"
SET "delivery_windows" = jsonb_build_object(
        'frequency', 'DAILY',
        'daysOfWeek', jsonb_build_array(1, 2, 3, 4, 5),
        'cutoff', CASE WHEN "region" = 'CABA' THEN '15:00' ELSE '13:00' END,
        'collectionCutoffs', CASE
            WHEN "region" = 'CABA' THEN jsonb_build_array(
                jsonb_build_object('time', '13:00', 'coverage', 'AMBA'),
                jsonb_build_object('time', '15:00', 'coverage', 'CABA')
            )
            ELSE jsonb_build_array(
                jsonb_build_object('time', '13:00', 'coverage', 'AMBA')
            )
        END,
        'deliverySlots', jsonb_build_array(
            jsonb_build_object(
                'id', 'STANDARD_13_19',
                'label', '13:00 a 19:00',
                'start', '13:00',
                'end', '19:00'
            )
        ),
        'timezone', 'America/Argentina/Buenos_Aires'
    ),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN (
  '00000000-0000-4000-8000-000000000411',
  '00000000-0000-4000-8000-000000000412',
  '00000000-0000-4000-8000-000000000413',
  '00000000-0000-4000-8000-000000000414'
);

INSERT INTO "shipping_options"
    ("id", "name", "description", "cost", "active", "display_order", "updated_at")
VALUES
    ('00000000-0000-4000-8000-000000000401', 'Entrega a domicilio', 'Entrega según cobertura, fecha y franja disponibles.', 0, true, 1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "shipping_options"
SET
    "name" = 'Entrega a domicilio',
    "description" = 'Entrega según cobertura, fecha y franja disponibles.',
    "cost" = 0,
    "active" = true,
    "display_order" = 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = '00000000-0000-4000-8000-000000000401';

UPDATE "checkout_sessions"
SET "shipping_option_id" = '00000000-0000-4000-8000-000000000401'
WHERE "status" = 'DRAFT'
  AND "shipping_option_id" IS NOT NULL;

UPDATE "orders"
SET "shipping_option_id" = '00000000-0000-4000-8000-000000000401'
WHERE "status" = 'PENDING_PAYMENT'
  AND "shipping_option_id" IS NOT NULL;

UPDATE "shipping_options"
SET "active" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE "active" = true
  AND "id" <> '00000000-0000-4000-8000-000000000401';

UPDATE "checkout_sessions"
SET "shipping_delivery_slot" = 'STANDARD_13_19'
WHERE "shipping_delivery_slot" = 'LAMBDA_STANDARD';

UPDATE "orders"
SET
    "shipping_delivery_slot" = 'STANDARD_13_19',
    "shipping_delivery_slot_label" = '13:00 a 19:00'
WHERE "shipping_delivery_slot" = 'LAMBDA_STANDARD';

UPDATE "orders"
SET "shipping_method" = 'Entrega a domicilio'
WHERE "shipping_method" ILIKE '%lambda%';

DO $$
DECLARE
    invalid_weights INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_weights
    FROM "product_variants" AS pv
    INNER JOIN "products" AS p ON p."id" = pv."product_id"
    WHERE pv."active" = true
      AND p."status" = 'ACTIVE'
      AND p."category_id" IS NOT NULL
      AND pv."sku" IS NOT NULL
      AND pv."sale_price" > 0
      AND (pv."weight_grams" IS NULL OR pv."weight_grams" <= 0);

    IF invalid_weights > 0 THEN
        RAISE EXCEPTION 'No se puede pasar a producción: % variantes no tienen peso logístico válido.', invalid_weights;
    END IF;
END $$;

DELETE FROM "payment_provider_configurations"
WHERE "provider" = 'SIMULATED';

ALTER TYPE "PaymentProviderConfigurationName"
    RENAME TO "PaymentProviderConfigurationName_legacy";

CREATE TYPE "PaymentProviderConfigurationName" AS ENUM ('MERCADO_PAGO', 'PAYWAY');

ALTER TABLE "payment_provider_configurations"
    ALTER COLUMN "provider" TYPE "PaymentProviderConfigurationName"
    USING "provider"::text::"PaymentProviderConfigurationName";

DROP TYPE "PaymentProviderConfigurationName_legacy";
