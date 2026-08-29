ALTER TABLE "orders"
    ADD COLUMN IF NOT EXISTS "shipping_provider_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "shipping_subsidy" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "shipping_delivery_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "shipping_vat" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "checkout_sessions"
    ADD COLUMN IF NOT EXISTS "shipping_provider_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "shipping_subsidy" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "shipping_delivery_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "shipping_vat" DECIMAL(14,2) NOT NULL DEFAULT 0;

INSERT INTO "shipping_options"
    ("id", "name", "description", "cost", "active", "display_order", "updated_at")
VALUES
    ('00000000-0000-4000-8000-000000000401', 'Lambda Logística', 'Envío coordinado por Lambda Logística.', 0, true, 1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "active" = EXCLUDED."active",
    "display_order" = EXCLUDED."display_order";

INSERT INTO "shipping_zones"
    ("id", "name", "coverage_type", "active", "priority", "postal_codes", "neighborhoods", "cost", "max_weight_grams", "estimated_days_min", "estimated_days_max", "delivery_windows", "updated_at")
VALUES
    (
        '00000000-0000-4000-8000-000000000411',
        'CABA / Mismo partido',
        'NEIGHBORHOOD', true, 40, '{}',
        ARRAY['CABA', 'Capital Federal', 'Ciudad Autónoma de Buenos Aires'],
        3711, 30000, 1, 1,
        '{"frequency":"DAILY","collectionCutoffs":[{"time":"13:00","coverage":"AMBA"},{"time":"15:00","coverage":"CABA"}],"timezone":"America/Argentina/Buenos_Aires"}'::jsonb,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-4000-8000-000000000412',
        'Partido cercano / Cordón 1',
        'NEIGHBORHOOD', true, 30, '{}',
        ARRAY['Vicente López', 'San Isidro', 'San Martín', '3 de Febrero', 'Morón', 'Hurlingham', 'Ituzaingó', 'Ramos Mejía', 'Villa Luzuriaga', 'Villa Madero', 'Ciudad Madero', 'San Justo', 'Lomas del Mirador', 'Avellaneda', 'Lanús', 'Lomas de Zamora'],
        5364, 30000, 1, 3,
        '{"frequency":"DAILY","collectionCutoffs":[{"time":"13:00","coverage":"AMBA"}],"timezone":"America/Argentina/Buenos_Aires"}'::jsonb,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-4000-8000-000000000413',
        'Partido lejano / Cordón 2',
        'NEIGHBORHOOD', true, 20, '{}',
        ARRAY['González Catán', 'Gregorio Laferrere', 'Isidro Casanova', 'Villa Celina', 'Aldo Bonzi', 'Virrey del Pino', 'Rafael Castillo', 'Ciudad Evita', 'Merlo', 'Moreno', 'San Miguel', 'José C. Paz', 'Malvinas Argentinas', 'Tigre', 'San Fernando', 'Quilmes', 'Florencio Varela', 'Berazategui', 'Almirante Brown', 'Esteban Echeverría', 'Ezeiza'],
        7182, 30000, 2, 4,
        '{"frequency":"DAILY","collectionCutoffs":[{"time":"13:00","coverage":"AMBA"}],"timezone":"America/Argentina/Buenos_Aires"}'::jsonb,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-4000-8000-000000000414',
        'Nuevas zonas ML / Cordón 3',
        'NEIGHBORHOOD', true, 10, '{}',
        ARRAY['General Rodríguez', 'Luján', 'Pilar', 'Derqui', 'Ingeniero Maschwitz', 'Escobar', 'Villa Rosa', 'Nordelta', 'Cañuelas', 'La Plata Centro', 'La Plata Oeste', 'La Plata Norte', 'Berisso', 'Ensenada', 'Del Viso', 'Garín', 'Zárate', 'Marcos Paz', 'Campana', 'San Vicente', 'Guernica'],
        8256, 30000, 2, 5,
        '{"frequency":"DAILY","collectionCutoffs":[{"time":"13:00","coverage":"AMBA"}],"timezone":"America/Argentina/Buenos_Aires"}'::jsonb,
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "coverage_type" = EXCLUDED."coverage_type",
    "active" = EXCLUDED."active",
    "priority" = EXCLUDED."priority",
    "postal_codes" = EXCLUDED."postal_codes",
    "neighborhoods" = EXCLUDED."neighborhoods",
    "cost" = EXCLUDED."cost",
    "max_weight_grams" = EXCLUDED."max_weight_grams",
    "estimated_days_min" = EXCLUDED."estimated_days_min",
    "estimated_days_max" = EXCLUDED."estimated_days_max",
    "delivery_windows" = EXCLUDED."delivery_windows";
