UPDATE "shipping_zones"
SET
    "neighborhoods" = ARRAY[
        'CABA',
        'Capital Federal',
        'Ciudad Autónoma de Buenos Aires',
        'Villa Crespo',
        'Villacrespo'
    ],
    "delivery_windows" = COALESCE("delivery_windows", '{}'::jsonb) ||
        '{"postalCodeRanges":[{"min":1000,"max":1499}]}'::jsonb,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = '00000000-0000-4000-8000-000000000411';
