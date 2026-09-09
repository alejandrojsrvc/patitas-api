-- Normalize the initial zone configuration by its stable business names.
-- The previous migration used fixed IDs, but older installations may have
-- generated different UUIDs for the same initial zones.

UPDATE "shipping_zones"
SET
    "name" = 'Nuevas zonas / Cordón 3',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "name" = 'Nuevas zonas ML / Cordón 3';

UPDATE "shipping_zones"
SET
    "region" = CASE
        WHEN "name" = 'CABA / Mismo partido' THEN 'CABA'::"ShippingOperatingRegion"
        ELSE 'AMBA'::"ShippingOperatingRegion"
    END,
    "delivery_windows" = jsonb_build_object(
        'frequency', 'DAILY',
        'daysOfWeek', jsonb_build_array(1, 2, 3, 4, 5),
        'cutoff', CASE WHEN "name" = 'CABA / Mismo partido' THEN '15:00' ELSE '13:00' END,
        'collectionCutoffs', CASE
            WHEN "name" = 'CABA / Mismo partido' THEN jsonb_build_array(
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
WHERE "name" IN (
    'CABA / Mismo partido',
    'Partido cercano / Cordón 1',
    'Partido lejano / Cordón 2',
    'Nuevas zonas / Cordón 3'
);
