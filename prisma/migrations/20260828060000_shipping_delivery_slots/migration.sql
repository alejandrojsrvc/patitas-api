ALTER TABLE "orders"
    ADD COLUMN IF NOT EXISTS "shipping_delivery_slot" TEXT,
    ADD COLUMN IF NOT EXISTS "shipping_delivery_date" DATE;

ALTER TABLE "checkout_sessions"
    ADD COLUMN IF NOT EXISTS "shipping_delivery_slot" TEXT,
    ADD COLUMN IF NOT EXISTS "shipping_delivery_date" DATE;

UPDATE "shipping_zones"
SET "delivery_windows" = COALESCE("delivery_windows", '{}'::jsonb) ||
    '{"daysOfWeek":[1,2,3,4,5],"cutoff":"13:00","collectionCutoffs":[{"time":"13:00","coverage":"AMBA"}],"deliverySlots":[{"id":"MORNING","label":"10:00 a 12:00","start":"10:00","end":"12:00"},{"id":"EVENING","label":"18:00 a 20:00","start":"18:00","end":"20:00"}],"timezone":"America/Argentina/Buenos_Aires"}'::jsonb,
    "updated_at" = CURRENT_TIMESTAMP;

DO $$
DECLARE
    old_id UUID;
    replacement_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM "shipping_options" WHERE "id" = '00000000-0000-4000-8000-000000000401') THEN
        replacement_id := gen_random_uuid();
        INSERT INTO "shipping_options"
            ("id", "name", "description", "cost", "active", "display_order", "created_at", "updated_at")
        SELECT replacement_id, "name", "description", "cost", "active", "display_order", "created_at", CURRENT_TIMESTAMP
        FROM "shipping_options"
        WHERE "id" = '00000000-0000-4000-8000-000000000401';
        UPDATE "checkout_sessions"
        SET "shipping_option_id" = replacement_id
        WHERE "shipping_option_id" = '00000000-0000-4000-8000-000000000401';
        UPDATE "orders"
        SET "shipping_option_id" = replacement_id
        WHERE "shipping_option_id" = '00000000-0000-4000-8000-000000000401';
        DELETE FROM "shipping_options"
        WHERE "id" = '00000000-0000-4000-8000-000000000401';
    END IF;

    FOR old_id IN
        SELECT "id"
        FROM "shipping_zones"
        WHERE "id" IN (
            '00000000-0000-4000-8000-000000000411',
            '00000000-0000-4000-8000-000000000412',
            '00000000-0000-4000-8000-000000000413',
            '00000000-0000-4000-8000-000000000414'
        )
    LOOP
        replacement_id := gen_random_uuid();
        INSERT INTO "shipping_zones"
            ("id", "name", "coverage_type", "active", "priority", "postal_codes", "neighborhoods", "polygon", "cost", "free_shipping_from", "max_weight_grams", "estimated_days_min", "estimated_days_max", "delivery_windows", "created_at", "updated_at")
        SELECT replacement_id, "name", "coverage_type", "active", "priority", "postal_codes", "neighborhoods", "polygon", "cost", "free_shipping_from", "max_weight_grams", "estimated_days_min", "estimated_days_max", "delivery_windows", "created_at", CURRENT_TIMESTAMP
        FROM "shipping_zones"
        WHERE "id" = old_id;
        UPDATE "checkout_sessions"
        SET "shipping_zone_id" = replacement_id
        WHERE "shipping_zone_id" = old_id;
        UPDATE "orders"
        SET "shipping_zone_id" = replacement_id
        WHERE "shipping_zone_id" = old_id;
        DELETE FROM "shipping_zones"
        WHERE "id" = old_id;
    END LOOP;
END $$;
