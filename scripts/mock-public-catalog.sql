-- Mockup local del catálogo público.
-- Ejecutar solo contra PostgreSQL local. No contiene datos reales.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM brands WHERE slug = 'excellent') THEN
    RAISE EXCEPTION 'No existe la marca excellent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'alimento-seco') THEN
    RAISE EXCEPTION 'No existe la categoría alimento-seco';
  END IF;
END $$;

INSERT INTO products (
  id, name, slug, description, brand_id, category_id, species,
  line, life_stage, breed_size, estimated_daily_grams_per_kg,
  featured_rank, status
)
SELECT
  data.id::uuid,
  data.name,
  data.slug,
  data.description,
  brands.id,
  categories.id,
  data.species,
  data.line,
  data.life_stage,
  data.breed_size,
  data.daily_grams_per_kg::numeric,
  data.featured_rank,
  'ACTIVE'::"ProductStatus"
FROM (
  VALUES
    ('90000000-0000-4000-8000-000000000001', 'Excellent Balance Adulto Pollo', 'mock-excellent-balance-adulto-pollo', 'Alimento completo para perros adultos. Una ficha de demostración con descripción larga, beneficios y presentación comercial.', 'DOG', 'Balance', 'ADULT', 'ALL', '17', 1),
    ('90000000-0000-4000-8000-000000000002', 'Excellent Balance Puppy', 'mock-excellent-balance-puppy', 'Fórmula de demostración para cachorros, pensada para mostrar una ficha técnica con etapa de vida, tamaños y guía de ración.', 'DOG', 'Balance', 'PUPPY', 'MEDIUM', '17', 2),
    ('90000000-0000-4000-8000-000000000003', 'Excellent Balance Gato Adulto', 'mock-excellent-balance-gato-adulto', 'Alimento seco de demostración para gatos adultos, con una descripción suficientemente extensa para diseñar la página pública.', 'CAT', 'Balance', 'ADULT', NULL, '13', 3),
    ('90000000-0000-4000-8000-000000000004', 'Excellent Balance Senior', 'mock-excellent-balance-senior', 'Receta mockup para perros senior. Sirve para probar badges, productos relacionados y el cálculo de duración.', 'DOG', 'Balance', 'SENIOR', 'ALL', '17', 4),
    ('90000000-0000-4000-8000-000000000005', 'Excellent Balance Razas Pequeñas', 'mock-excellent-balance-razas-pequenas', 'Fórmula de demostración para perros pequeños con croqueta adaptada y presentación de prueba.', 'DOG', 'Balance', 'ADULT', 'SMALL', '17', 5),
    ('90000000-0000-4000-8000-000000000006', 'Excellent Balance Indoor Cat', 'mock-excellent-balance-indoor-cat', 'Producto de prueba para gatos de interior, usado para validar filtros por especie y etapa de vida.', 'CAT', 'Balance', 'ADULT', NULL, '13', 6)
) AS data(id, name, slug, description, species, line, life_stage, breed_size, daily_grams_per_kg, featured_rank)
CROSS JOIN LATERAL (SELECT id FROM brands WHERE slug = 'excellent') brands
CROSS JOIN LATERAL (SELECT id FROM categories WHERE slug = 'alimento-seco') categories
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  brand_id = EXCLUDED.brand_id,
  category_id = EXCLUDED.category_id,
  species = EXCLUDED.species,
  line = EXCLUDED.line,
  life_stage = EXCLUDED.life_stage,
  breed_size = EXCLUDED.breed_size,
  estimated_daily_grams_per_kg = EXCLUDED.estimated_daily_grams_per_kg,
  featured_rank = EXCLUDED.featured_rank,
  status = 'ACTIVE'::"ProductStatus";

INSERT INTO product_variants (
  id, product_id, sku, presentation, weight_grams, sale_price,
  compare_at_price, active
)
SELECT
  data.id::uuid,
  products.id,
  data.sku,
  data.presentation,
  data.weight_grams,
  data.sale_price::numeric,
  data.compare_at_price::numeric,
  true
FROM (
  VALUES
    ('91000000-0000-4000-8000-000000000001', 'mock-excellent-balance-adulto-pollo', 'MOCK-ADULTO-1KG', '1 kg', 1000, '3990', '4990'),
    ('91000000-0000-4000-8000-000000000002', 'mock-excellent-balance-adulto-pollo', 'MOCK-ADULTO-3KG', '3 kg', 3000, '8990', '10990'),
    ('91000000-0000-4000-8000-000000000003', 'mock-excellent-balance-adulto-pollo', 'MOCK-ADULTO-15KG', '15 kg', 15000, '29990', '34990'),
    ('91000000-0000-4000-8000-000000000004', 'mock-excellent-balance-puppy', 'MOCK-PUPPY-3KG', '3 kg', 3000, '9490', '11990'),
    ('91000000-0000-4000-8000-000000000005', 'mock-excellent-balance-puppy', 'MOCK-PUPPY-15KG', '15 kg', 15000, '31990', '36990'),
    ('91000000-0000-4000-8000-000000000006', 'mock-excellent-balance-gato-adulto', 'MOCK-CAT-1KG', '1 kg', 1000, '4490', '5490'),
    ('91000000-0000-4000-8000-000000000007', 'mock-excellent-balance-gato-adulto', 'MOCK-CAT-3KG', '3 kg', 3000, '9990', '11990'),
    ('91000000-0000-4000-8000-000000000008', 'mock-excellent-balance-senior', 'MOCK-SENIOR-3KG', '3 kg', 3000, '8490', '9990'),
    ('91000000-0000-4000-8000-000000000009', 'mock-excellent-balance-senior', 'MOCK-SENIOR-15KG', '15 kg', 15000, '28990', '33990'),
    ('91000000-0000-4000-8000-000000000010', 'mock-excellent-balance-razas-pequenas', 'MOCK-SMALL-1KG', '1 kg', 1000, '4290', '5290'),
    ('91000000-0000-4000-8000-000000000011', 'mock-excellent-balance-razas-pequenas', 'MOCK-SMALL-3KG', '3 kg', 3000, '9490', '11490'),
    ('91000000-0000-4000-8000-000000000012', 'mock-excellent-balance-indoor-cat', 'MOCK-INDOOR-1KG', '1 kg', 1000, '4790', '5790'),
    ('91000000-0000-4000-8000-000000000013', 'mock-excellent-balance-indoor-cat', 'MOCK-INDOOR-3KG', '3 kg', 3000, '10490', '12490')
) AS data(id, product_slug, sku, presentation, weight_grams, sale_price, compare_at_price)
JOIN products ON products.slug = data.product_slug
ON CONFLICT (sku) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  presentation = EXCLUDED.presentation,
  weight_grams = EXCLUDED.weight_grams,
  sale_price = EXCLUDED.sale_price,
  compare_at_price = EXCLUDED.compare_at_price,
  active = true,
  revision = product_variants.revision + 1;

INSERT INTO inventory_items (variant_id, on_hand, reserved)
SELECT product_variants.id, 25, 0
FROM product_variants
WHERE product_variants.sku LIKE 'MOCK-%'
ON CONFLICT (variant_id) DO UPDATE SET on_hand = 25, reserved = 0;

INSERT INTO product_media (id, product_id, url, alt_text, display_order)
SELECT
  data.id::uuid,
  products.id,
  data.url,
  data.alt_text,
  0
FROM (
  VALUES
    ('92000000-0000-4000-8000-000000000001', 'mock-excellent-balance-adulto-pollo', 'https://placehold.co/900x900/png?text=Adulto+Pollo', 'Bolsa Excellent Balance Adulto Pollo'),
    ('92000000-0000-4000-8000-000000000002', 'mock-excellent-balance-puppy', 'https://placehold.co/900x900/png?text=Puppy', 'Bolsa Excellent Balance Puppy'),
    ('92000000-0000-4000-8000-000000000003', 'mock-excellent-balance-gato-adulto', 'https://placehold.co/900x900/png?text=Gato+Adulto', 'Bolsa Excellent Balance Gato Adulto'),
    ('92000000-0000-4000-8000-000000000004', 'mock-excellent-balance-senior', 'https://placehold.co/900x900/png?text=Senior', 'Bolsa Excellent Balance Senior'),
    ('92000000-0000-4000-8000-000000000005', 'mock-excellent-balance-razas-pequenas', 'https://placehold.co/900x900/png?text=Razas+Pequenas', 'Bolsa Excellent Balance Razas Pequeñas'),
    ('92000000-0000-4000-8000-000000000006', 'mock-excellent-balance-indoor-cat', 'https://placehold.co/900x900/png?text=Indoor+Cat', 'Bolsa Excellent Balance Indoor Cat')
) AS data(id, product_slug, url, alt_text)
JOIN products ON products.slug = data.product_slug
ON CONFLICT (id) DO UPDATE SET
  url = EXCLUDED.url,
  alt_text = EXCLUDED.alt_text;

INSERT INTO feeding_guides (
  id, product_id, source_label, source_url, version, required_dimensions, active
)
SELECT
  data.id::uuid,
  products.id,
  'Tabla de alimentación mockup local',
  NULL,
  1,
  '{}'::jsonb,
  true
FROM (
  VALUES
    ('93000000-0000-4000-8000-000000000001', 'mock-excellent-balance-adulto-pollo'),
    ('93000000-0000-4000-8000-000000000002', 'mock-excellent-balance-puppy'),
    ('93000000-0000-4000-8000-000000000003', 'mock-excellent-balance-gato-adulto'),
    ('93000000-0000-4000-8000-000000000004', 'mock-excellent-balance-senior'),
    ('93000000-0000-4000-8000-000000000005', 'mock-excellent-balance-razas-pequenas'),
    ('93000000-0000-4000-8000-000000000006', 'mock-excellent-balance-indoor-cat')
) AS data(id, product_slug)
JOIN products ON products.slug = data.product_slug
ON CONFLICT (product_id, version) DO UPDATE SET
  source_label = EXCLUDED.source_label,
  active = true;

INSERT INTO feeding_guide_entries (
  id, feeding_guide_id, pet_weight_kg, life_stage, conditions,
  daily_grams_min, daily_grams_max
)
SELECT
  data.id::uuid,
  feeding_guides.id,
  data.pet_weight_kg::numeric,
  products.life_stage,
  '{}'::jsonb,
  data.daily_min::numeric,
  data.daily_max::numeric
FROM (
  VALUES
    ('94000000-0000-4000-8000-000000000001', 'mock-excellent-balance-adulto-pollo', 2, 45, 55),
    ('94000000-0000-4000-8000-000000000002', 'mock-excellent-balance-adulto-pollo', 10, 170, 190),
    ('94000000-0000-4000-8000-000000000003', 'mock-excellent-balance-adulto-pollo', 25, 360, 390),
    ('94000000-0000-4000-8000-000000000004', 'mock-excellent-balance-puppy', 2, 70, 80),
    ('94000000-0000-4000-8000-000000000005', 'mock-excellent-balance-puppy', 10, 230, 260),
    ('94000000-0000-4000-8000-000000000006', 'mock-excellent-balance-gato-adulto', 3, 45, 55),
    ('94000000-0000-4000-8000-000000000007', 'mock-excellent-balance-gato-adulto', 6, 75, 90),
    ('94000000-0000-4000-8000-000000000008', 'mock-excellent-balance-senior', 10, 150, 170),
    ('94000000-0000-4000-8000-000000000009', 'mock-excellent-balance-senior', 25, 320, 350),
    ('94000000-0000-4000-8000-000000000010', 'mock-excellent-balance-razas-pequenas', 2, 45, 55),
    ('94000000-0000-4000-8000-000000000011', 'mock-excellent-balance-razas-pequenas', 8, 135, 155),
    ('94000000-0000-4000-8000-000000000012', 'mock-excellent-balance-indoor-cat', 3, 45, 55),
    ('94000000-0000-4000-8000-000000000013', 'mock-excellent-balance-indoor-cat', 6, 75, 90)
) AS data(id, product_slug, pet_weight_kg, daily_min, daily_max)
JOIN products ON products.slug = data.product_slug
JOIN feeding_guides ON feeding_guides.product_id = products.id AND feeding_guides.version = 1
ON CONFLICT (id) DO UPDATE SET
  pet_weight_kg = EXCLUDED.pet_weight_kg,
  daily_grams_min = EXCLUDED.daily_grams_min,
  daily_grams_max = EXCLUDED.daily_grams_max;
