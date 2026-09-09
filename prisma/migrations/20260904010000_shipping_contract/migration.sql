ALTER TABLE "orders"
    ADD COLUMN IF NOT EXISTS "shipping_zone_name" TEXT,
    ADD COLUMN IF NOT EXISTS "shipping_tariff" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "shipping_delivery_slot_label" TEXT;

UPDATE "shipping_zones"
SET "delivery_windows" = jsonb_build_object(
        'frequency', 'DAILY',
        'daysOfWeek', ARRAY[1,2,3,4,5],
        'cutoff', CASE WHEN lower("name") LIKE '%caba%' THEN '15:00' ELSE '13:00' END,
        'collectionCutoffs', CASE
            WHEN lower("name") LIKE '%caba%'
            THEN jsonb_build_array(
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
WHERE "active" = true
  AND (
      "name" IN (
          'CABA / Mismo partido',
          'Partido cercano / Cordón 1',
          'Partido lejano / Cordón 2',
          'Nuevas zonas ML / Cordón 3'
      )
      OR "delivery_windows"->'deliverySlots' @> '[{"id":"MORNING"}]'::jsonb
      OR "delivery_windows"->'deliverySlots' @> '[{"id":"EVENING"}]'::jsonb
  );

UPDATE "orders" AS o
SET
    "shipping_zone_name" = z."name",
    "shipping_tariff" = z."cost",
    "shipping_delivery_slot_label" = CASE
        WHEN o."shipping_delivery_slot" = 'STANDARD_13_19' THEN '13:00 a 19:00'
        ELSE o."shipping_delivery_slot"
    END
FROM "shipping_zones" AS z
WHERE o."shipping_zone_id" = z."id"
  AND (o."shipping_zone_name" IS NULL OR o."shipping_tariff" = 0);
