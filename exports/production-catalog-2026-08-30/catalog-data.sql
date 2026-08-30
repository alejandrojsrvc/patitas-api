-- Exportación de catálogo Patitas para producción.

-- Excluye Test Product y marcas Test <uuid>. Preserva UUIDs válidos.

BEGIN;

INSERT INTO "categories" ("id", "name", "slug", "description", "seo_title", "seo_description", "display_order", "parent_id", "active", "created_at", "updated_at") VALUES
  ('10000000-0000-4000-8000-000000000001', 'Alimentos', 'alimentos', NULL, NULL, NULL, 10, NULL, TRUE, '2026-08-22T01:31:07.481Z'::timestamptz, '2026-08-22T01:31:07.481Z'::timestamptz),
  ('10000000-0000-4000-8000-000000000002', 'Alimento seco', 'alimento-seco', NULL, NULL, NULL, 11, '10000000-0000-4000-8000-000000000001', TRUE, '2026-08-22T01:31:07.481Z'::timestamptz, '2026-08-22T01:31:07.484Z'::timestamptz)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "description" = EXCLUDED."description",
  "seo_title" = EXCLUDED."seo_title",
  "seo_description" = EXCLUDED."seo_description",
  "display_order" = EXCLUDED."display_order",
  "parent_id" = EXCLUDED."parent_id",
  "active" = EXCLUDED."active",
  "created_at" = EXCLUDED."created_at",
  "updated_at" = EXCLUDED."updated_at";


INSERT INTO "brands" ("id", "name", "slug", "description", "seo_title", "seo_description", "logo_url", "display_order", "active", "created_at", "updated_at") VALUES
  ('5b1cf136-e03e-4d11-8ecf-e0694a6a9d3f', 'Excellent', 'excellent', NULL, NULL, NULL, NULL, 0, TRUE, '2026-08-21T22:34:18.510Z'::timestamptz, '2026-08-22T02:27:56.142Z'::timestamptz),
  ('bf1d3d55-73fe-41b9-93cc-a83cabba0885', 'Old Prince', 'old-prince', NULL, NULL, NULL, NULL, 0, TRUE, '2026-08-21T22:34:18.510Z'::timestamptz, '2026-08-22T02:27:56.142Z'::timestamptz),
  ('d700ac9d-043c-4d59-b7bd-a119d04ab37a', 'Pro Plan', 'pro-plan', NULL, NULL, NULL, NULL, 0, TRUE, '2026-08-21T22:34:18.510Z'::timestamptz, '2026-08-22T02:27:56.142Z'::timestamptz)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "description" = EXCLUDED."description",
  "seo_title" = EXCLUDED."seo_title",
  "seo_description" = EXCLUDED."seo_description",
  "logo_url" = EXCLUDED."logo_url",
  "display_order" = EXCLUDED."display_order",
  "active" = EXCLUDED."active",
  "created_at" = EXCLUDED."created_at",
  "updated_at" = EXCLUDED."updated_at";


INSERT INTO "products" ("id", "name", "slug", "description", "ingredients_text", "analytical_composition", "brand_id", "category_id", "line", "species", "life_stage", "breed_size", "estimated_daily_grams_per_kg", "featured_rank", "status", "created_at", "updated_at") VALUES
  ('09b0e408-41b1-4128-9640-c2c288d1b1cd', 'Alimento Excellent para Perro Adulto Mediano y Grande', 'excellent-perro-adulto-mediano-grande-15-kg', 'Alimento seco completo para perros adultos de razas medianas y grandes. Formulado con proteínas de alta calidad, prebióticos y ácidos grasos Omega 3 y 6 para acompañar la salud digestiva, la piel, el pelaje y el bienestar general.', NULL, '{}'::jsonb, '5b1cf136-e03e-4d11-8ecf-e0694a6a9d3f', '10000000-0000-4000-8000-000000000002', 'Excellent', 'perro', 'adulto', 'mediano y grande', NULL, NULL, 'ACTIVE', '2026-08-24T11:28:31.354Z'::timestamptz, '2026-08-27T00:22:26.633Z'::timestamptz),
  ('ad066827-5742-49b6-ba83-6037750632d7', 'Alimento Excellent para Perro Adulto Raza Pequeña', 'excellent-perro-adulto-raza-pequena-15-kg', 'Alimento seco completo para perros adultos de razas pequeñas. Aporta proteínas de alta calidad, antioxidantes y nutrientes orientados al mantenimiento de la piel, el pelaje y el equilibrio intestinal.', NULL, '{}'::jsonb, '5b1cf136-e03e-4d11-8ecf-e0694a6a9d3f', '10000000-0000-4000-8000-000000000002', 'Excellent', 'perro', 'adulto', 'pequeña', NULL, NULL, 'ACTIVE', '2026-08-24T11:28:31.457Z'::timestamptz, '2026-08-26T23:37:20.714Z'::timestamptz),
  ('a36c5670-065d-45ed-9d5b-ef4c0cc1d73f', 'Alimento Excellent para Perro Cachorro Mediano y Grande', 'excellent-perro-cachorro-mediano-grande-15-kg', 'Alimento seco completo para cachorros de razas medianas y grandes. Su fórmula aporta proteínas de alta calidad, antioxidantes y DHA para acompañar el crecimiento, las defensas y el desarrollo.', NULL, '{}'::jsonb, '5b1cf136-e03e-4d11-8ecf-e0694a6a9d3f', '10000000-0000-4000-8000-000000000002', 'Excellent', 'perro', 'cachorro', 'mediano y grande', NULL, NULL, 'ACTIVE', '2026-08-24T11:28:31.564Z'::timestamptz, '2026-08-26T23:39:44.098Z'::timestamptz),
  ('8c21c0dd-94fc-4bc1-a026-6ab005a118ea', 'Alimento Old Prince Equilibrium para Perro Adulto Mediano y Grande', 'old-prince-equilibrium-perro-adulto-mediano-grande-15-kg', 'Alimento completo para perros adultos de razas medianas y grandes de la línea Old Prince Equilibrium. Pensado para alimentación diaria y mantenimiento de perros adultos.', NULL, '{}'::jsonb, 'bf1d3d55-73fe-41b9-93cc-a83cabba0885', '10000000-0000-4000-8000-000000000002', 'Equilibrium', 'perro', 'adulto', 'mediano y grande', NULL, NULL, 'ACTIVE', '2026-08-24T11:28:31.603Z'::timestamptz, '2026-08-26T23:44:16.266Z'::timestamptz),
  ('6fdc1166-88ee-45b0-a862-7d2880280b52', 'Alimento Old Prince Equilibrium para Perro Adulto Raza Pequeña', 'old-prince-equilibrium-perro-adulto-raza-pequena-15-kg', 'Alimento completo para perros adultos de razas pequeñas de la línea Old Prince Equilibrium. Formulado para la alimentación cotidiana de perros adultos pequeños.', NULL, '{}'::jsonb, 'bf1d3d55-73fe-41b9-93cc-a83cabba0885', '10000000-0000-4000-8000-000000000002', 'Equilibrium', 'perro', 'adulto', 'pequeña', NULL, NULL, 'ACTIVE', '2026-08-24T11:28:31.637Z'::timestamptz, '2026-08-26T23:45:56.771Z'::timestamptz),
  ('7bc8356d-f03c-494f-87a8-f159acff9eae', 'Alimento Old Prince Equilibrium para Gato Adulto', 'old-prince-equilibrium-gato-adulto-7-5-kg', 'Alimento completo de la línea Old Prince Equilibrium para gatos adultos. Presentación de 7,5 kg para alimentación diaria de gatos adultos.', NULL, '{}'::jsonb, 'bf1d3d55-73fe-41b9-93cc-a83cabba0885', '10000000-0000-4000-8000-000000000002', 'Equilibrium', 'gato', 'adulto', NULL, NULL, NULL, 'ACTIVE', '2026-08-24T11:28:31.687Z'::timestamptz, '2026-08-26T23:43:01.535Z'::timestamptz),
  ('1d26503f-9d58-4030-b01b-244b7969e1a2', 'Alimento Excellent para Gato Adulto', 'excellent-gato-adulto-7-5-kg', 'Alimento seco completo para gatos adultos de la línea Purina Excellent. Formulado para cubrir las necesidades nutricionales de mantenimiento del gato adulto.', 'Harina de subproductos de pollo, maíz, trigo, gluten de maíz, harina de carne y hueso vacuna y/o porcina, aceite de pollo y/o grasa vacuna y/o grasa de cerdo preservadas con tocoferoles (fuente de vitamina E), arroz, hidrolizado (polvo y/o líquido) a base de subproductos de pollo y/o cerdo, bisulfato de sodio y/o ácido fosfórico, cloruro de sodio y/o cloruro de potasio, harina de pescado y/o harina de alga (Schizochytrium sp.), DL-metionina, cloruro de colina, suplemento vitamínico antioxidante (A, D3, E, K3, B1, B2, B3, B5, B6, B7, B9, B12, BHT), suplementos minerales [(sulfatos: zinc, hierro, manganeso, cobre,(proteinatos y/o glicinatos: zinc, hierro, manganeso, cobre, selenio), yodato de calcio, selenito de sodio], L-lisina, taurina, levadura seca (Saccharomyces cerevisiae).', '{"Calcio":{"unit":"%","maximum":"1.6","minimum":"1.0","rawValue":null},"Humedad":{"unit":"%","maximum":"12.0","minimum":null,"rawValue":null},"Fósforo":{"unit":"%","maximum":"1.5","minimum":"0.9","rawValue":null},"Fibra cruda":{"unit":"%","maximum":"3","minimum":null,"rawValue":null},"Proteína cruda":{"unit":"%","maximum":null,"minimum":"33","rawValue":null},"Cenizas/Minerales":{"unit":"%","maximum":"9.5","minimum":null,"rawValue":null},"Extracto Etéreo/Grasa cruda":{"unit":"%","maximum":null,"minimum":"13","rawValue":null}}'::jsonb, '5b1cf136-e03e-4d11-8ecf-e0694a6a9d3f', '10000000-0000-4000-8000-000000000002', 'Excellent', 'Gato', 'adulto', NULL, NULL, NULL, 'ACTIVE', '2026-08-24T11:28:31.723Z'::timestamptz, '2026-08-27T13:15:44.697Z'::timestamptz),
  ('19d2e749-5f2f-4717-8132-f60726965f14', 'Alimento Pro Plan para Perro Adulto Raza Mediana', 'pro-plan-perro-adulto-raza-mediana-12-kg', 'Alimento seco completo para perros adultos de razas medianas. Formulado para acompañar la vitalidad, el mantenimiento corporal y las necesidades nutricionales de perros adultos.', NULL, '{}'::jsonb, 'd700ac9d-043c-4d59-b7bd-a119d04ab37a', '10000000-0000-4000-8000-000000000002', 'Adult', 'perro', 'adulto', 'mediana', NULL, NULL, 'ACTIVE', '2026-08-24T11:28:31.756Z'::timestamptz, '2026-08-26T23:59:53.195Z'::timestamptz)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "description" = EXCLUDED."description",
  "ingredients_text" = EXCLUDED."ingredients_text",
  "analytical_composition" = EXCLUDED."analytical_composition",
  "brand_id" = EXCLUDED."brand_id",
  "category_id" = EXCLUDED."category_id",
  "line" = EXCLUDED."line",
  "species" = EXCLUDED."species",
  "life_stage" = EXCLUDED."life_stage",
  "breed_size" = EXCLUDED."breed_size",
  "estimated_daily_grams_per_kg" = EXCLUDED."estimated_daily_grams_per_kg",
  "featured_rank" = EXCLUDED."featured_rank",
  "status" = EXCLUDED."status",
  "created_at" = EXCLUDED."created_at",
  "updated_at" = EXCLUDED."updated_at";


INSERT INTO "product_variants" ("id", "product_id", "sku", "barcode", "presentation", "weight_grams", "sale_price", "compare_at_price", "active", "preferred_supplier_offer_id", "revision", "created_at", "updated_at") VALUES
  ('52a3f9a1-2f1a-4bf9-b216-214dff4974d6', '09b0e408-41b1-4128-9640-c2c288d1b1cd', 'PI-EXC-DOG-AD-MG-15K', NULL, '15 kg', 15000, '77990.00', NULL, TRUE, NULL, 10, '2026-08-24T11:28:31.414Z'::timestamptz, '2026-08-27T00:22:26.633Z'::timestamptz),
  ('f675f328-0554-4471-ab59-bc9609e98a38', '19d2e749-5f2f-4717-8132-f60726965f14', 'SKU PI-PP-DOG-AD-MED-', NULL, '3 kg', 3000, '50990.00', NULL, TRUE, NULL, 3, '2026-08-26T23:58:07.640Z'::timestamptz, '2026-08-26T23:59:53.195Z'::timestamptz),
  ('9eb96625-64b3-4af9-a141-d63954070a32', '19d2e749-5f2f-4717-8132-f60726965f14', 'PI-PP-DOG-AD-MED-12K', NULL, '12 kg', 12000, '106990.00', NULL, TRUE, NULL, 4, '2026-08-24T11:28:31.766Z'::timestamptz, '2026-08-26T23:50:19.762Z'::timestamptz),
  ('d4355459-1a52-4de4-aa6e-7dcc2442e88e', '1d26503f-9d58-4030-b01b-244b7969e1a2', 'PI-EXC-CAT-AD-75K', NULL, '7.5 kg', 7500, '70990.00', NULL, TRUE, NULL, 5, '2026-08-24T11:28:31.734Z'::timestamptz, '2026-08-27T01:32:08.228Z'::timestamptz),
  ('6cb327e2-650f-4109-a120-760b3f1b118c', '6fdc1166-88ee-45b0-a862-7d2880280b52', 'PI-OP-EQ-DOG-AD-SM-15K', NULL, '15 kg', 15000, '74990.00', NULL, TRUE, NULL, 4, '2026-08-24T11:28:31.650Z'::timestamptz, '2026-08-26T23:45:56.771Z'::timestamptz),
  ('0114dec0-b547-4a98-9946-bd8113ff0c9b', '7bc8356d-f03c-494f-87a8-f159acff9eae', 'PI-OP-EQ-CAT-AD-75K', NULL, '7.5 kg', 7500, '63990.00', NULL, TRUE, NULL, 4, '2026-08-24T11:28:31.699Z'::timestamptz, '2026-08-26T23:43:01.535Z'::timestamptz),
  ('8e67c094-46cb-4ddc-950f-d9a6ae4d876a', '8c21c0dd-94fc-4bc1-a026-6ab005a118ea', 'PI-OP-EQ-DOG-AD-MG-15K', NULL, '15 kg', 15000, '65990.00', NULL, TRUE, NULL, 4, '2026-08-24T11:28:31.616Z'::timestamptz, '2026-08-26T23:44:16.266Z'::timestamptz),
  ('1a609cbc-2706-45f4-8de0-518d8c4313f2', 'a36c5670-065d-45ed-9d5b-ef4c0cc1d73f', 'PI-EXC-DOG-PUP-MG-15K', NULL, '15 kg', 15000, '91990.00', NULL, TRUE, NULL, 4, '2026-08-24T11:28:31.579Z'::timestamptz, '2026-08-26T23:39:44.098Z'::timestamptz),
  ('a34cd0ec-e2fd-4c4b-abb3-710f11109c8a', 'ad066827-5742-49b6-ba83-6037750632d7', 'PI-EXC-DOG-AD-SM-15K', NULL, '15 kg', 15000, '87990.00', NULL, TRUE, NULL, 6, '2026-08-24T11:28:31.473Z'::timestamptz, '2026-08-26T23:37:20.714Z'::timestamptz)
ON CONFLICT ("id") DO UPDATE SET
  "product_id" = EXCLUDED."product_id",
  "sku" = EXCLUDED."sku",
  "barcode" = EXCLUDED."barcode",
  "presentation" = EXCLUDED."presentation",
  "weight_grams" = EXCLUDED."weight_grams",
  "sale_price" = EXCLUDED."sale_price",
  "compare_at_price" = EXCLUDED."compare_at_price",
  "active" = EXCLUDED."active",
  "preferred_supplier_offer_id" = EXCLUDED."preferred_supplier_offer_id",
  "revision" = EXCLUDED."revision",
  "created_at" = EXCLUDED."created_at",
  "updated_at" = EXCLUDED."updated_at";


INSERT INTO "inventory_items" ("id", "variant_id", "on_hand", "reserved", "updated_at") VALUES
  ('47d17be4-1d91-4935-afb6-382d615a45b6', '0114dec0-b547-4a98-9946-bd8113ff0c9b', 1, 0, '2026-08-24T11:28:31.715Z'::timestamptz),
  ('e6308eaf-7b34-403d-917b-1e0272f318e4', '1a609cbc-2706-45f4-8de0-518d8c4313f2', 1, 0, '2026-08-24T11:28:31.595Z'::timestamptz),
  ('f7ef534f-6d01-43f8-a818-724f78087347', '52a3f9a1-2f1a-4bf9-b216-214dff4974d6', 2, 0, '2026-08-29T14:26:20.823Z'::timestamptz),
  ('91afb68a-0262-4b9b-90b1-ee78da501e23', '6cb327e2-650f-4109-a120-760b3f1b118c', 1, 0, '2026-08-24T11:28:31.669Z'::timestamptz),
  ('68aa5c68-daaa-4ef0-8212-f04fc7456483', '8e67c094-46cb-4ddc-950f-d9a6ae4d876a', 2, 0, '2026-08-24T11:28:31.630Z'::timestamptz),
  ('59fbf558-f121-4484-961e-4354cee5f7a5', '9eb96625-64b3-4af9-a141-d63954070a32', 1, 0, '2026-08-24T11:28:31.780Z'::timestamptz),
  ('3893f704-ee00-4ff2-8c31-9ab09fbdd244', 'a34cd0ec-e2fd-4c4b-abb3-710f11109c8a', 1, 0, '2026-08-24T11:28:31.519Z'::timestamptz),
  ('e32eed6e-faa4-4007-a657-97b9426e2451', 'd4355459-1a52-4de4-aa6e-7dcc2442e88e', 1, 0, '2026-08-29T14:26:20.823Z'::timestamptz)
ON CONFLICT ("id") DO UPDATE SET
  "variant_id" = EXCLUDED."variant_id",
  "on_hand" = EXCLUDED."on_hand",
  "reserved" = EXCLUDED."reserved",
  "updated_at" = EXCLUDED."updated_at";


INSERT INTO "product_media" ("id", "product_id", "variant_id", "url", "alt_text", "display_order", "created_at") VALUES
  ('2ffd8309-c105-4bfd-a43d-78e34430fb20', '09b0e408-41b1-4128-9640-c2c288d1b1cd', NULL, 'products/09b0e408-41b1-4128-9640-c2c288d1b1cd/a2303498-f617-49fb-825c-0742a0802c10-D_NQ_NP_2X_660357-MLA99914158183_112025-F.webp', 'Imagen de Alimento Excellent para Perro Adulto Mediano y Grande', 0, '2026-08-26T23:34:59.445Z'::timestamptz),
  ('9a30694b-1b29-44e7-95af-545222743ad4', '19d2e749-5f2f-4717-8132-f60726965f14', NULL, 'products/19d2e749-5f2f-4717-8132-f60726965f14/0b0deb5c-988b-47af-a51c-a67b09e78b3c-razas-medianas-1-proplan.png', 'Imagen de Alimento Pro Plan para Perro Adulto Raza Mediana', 0, '2026-08-26T23:52:49.089Z'::timestamptz),
  ('7746da0f-6242-4fb1-8879-257d5138bcd4', '1d26503f-9d58-4030-b01b-244b7969e1a2', NULL, 'products/1d26503f-9d58-4030-b01b-244b7969e1a2/cd797a12-4080-4018-9ab4-590fff6a48f4-images-2-.jpeg', 'Imagen de Alimento Excellent para Gato Adulto 7,5 kg', 0, '2026-08-24T11:30:26.665Z'::timestamptz),
  ('8848efdc-5d73-47e3-9f58-598b8d00dd10', '6fdc1166-88ee-45b0-a862-7d2880280b52', NULL, 'products/6fdc1166-88ee-45b0-a862-7d2880280b52/2603e2cf-cad4-494f-8229-3862abaae414-Mockup_Equilibrium-adulto-Pequeno-1206x2048.png', 'Imagen de Alimento Old Prince Equilibrium para Perro Adulto Raza Pequeña 15 kg', 0, '2026-08-26T23:45:46.231Z'::timestamptz),
  ('a085103f-e465-4a2b-8e80-1d7facd7ecc6', '7bc8356d-f03c-494f-87a8-f159acff9eae', NULL, 'products/7bc8356d-f03c-494f-87a8-f159acff9eae/33a7a52d-84bb-40ea-a5d0-efea58e8aac6-Mockup_Equilibrium-Gato-urinario-1150x2048.png', 'Imagen de Alimento Old Prince Equilibrium para Gato Adulto 7,5 kg', 0, '2026-08-26T23:42:49.059Z'::timestamptz),
  ('419c279a-df2c-4846-9534-790def91468a', '8c21c0dd-94fc-4bc1-a026-6ab005a118ea', NULL, 'products/8c21c0dd-94fc-4bc1-a026-6ab005a118ea/08dc1d23-36fb-41c4-8e62-a3cb7937ed30-Mockup_Equilibrium-Adulto-MyG-1.png', 'Imagen de Alimento Old Prince Equilibrium para Perro Adulto Mediano y Grande 15 kg', 0, '2026-08-26T23:44:08.816Z'::timestamptz),
  ('cf3d7211-1a69-4ef3-a2f3-0852787e8d04', 'a36c5670-065d-45ed-9d5b-ef4c0cc1d73f', NULL, 'products/a36c5670-065d-45ed-9d5b-ef4c0cc1d73f/6d64939b-24ef-475f-9024-34b1392e90ec-Captura-de-pantalla-2026-08-26-a-las-20.39.03.png', 'Imagen de Alimento Excellent para Perro Cachorro Mediano y Grande 15 kg', 0, '2026-08-26T23:39:22.618Z'::timestamptz),
  ('7c66fd0d-e521-46c5-8cb7-fb81caf7cffa', 'ad066827-5742-49b6-ba83-6037750632d7', NULL, 'products/ad066827-5742-49b6-ba83-6037750632d7/1a20669e-6d36-44c8-b434-d7402f3e5b46-Excellent_Perros_AdultPequenos.png-1-.webp', 'Imagen de Alimento Excellent para Perro Adulto Raza Pequeña 15 kg', 0, '2026-08-26T23:36:35.499Z'::timestamptz)
ON CONFLICT ("id") DO UPDATE SET
  "product_id" = EXCLUDED."product_id",
  "variant_id" = EXCLUDED."variant_id",
  "url" = EXCLUDED."url",
  "alt_text" = EXCLUDED."alt_text",
  "display_order" = EXCLUDED."display_order",
  "created_at" = EXCLUDED."created_at";


INSERT INTO "suppliers" ("id", "name", "active", "created_at", "updated_at") VALUES
  ('192b146e-180e-4557-aa9b-be6205c5edd9', 'Distribuidora KF', TRUE, '2026-08-27T22:26:18.721Z'::timestamptz, '2026-08-27T22:26:18.721Z'::timestamptz),
  ('bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', 'Distribuidora Mona Pet Shop', TRUE, '2026-08-24T12:14:01.517Z'::timestamptz, '2026-08-24T12:14:01.517Z'::timestamptz),
  ('a5728ebc-e014-4493-9bd4-8e2ad74c508c', 'Distribuidora Pecas', TRUE, '2026-08-25T12:22:06.203Z'::timestamptz, '2026-08-25T12:22:06.203Z'::timestamptz),
  ('766bb960-e8bf-48fa-89da-d2a1560e1769', 'Distrubuidora Señor Gonzalez', TRUE, '2026-08-22T03:07:24.038Z'::timestamptz, '2026-08-25T12:21:32.130Z'::timestamptz)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "active" = EXCLUDED."active",
  "created_at" = EXCLUDED."created_at",
  "updated_at" = EXCLUDED."updated_at";


INSERT INTO "supplier_offers" ("id", "supplier_id", "variant_id", "supplier_sku", "unit_cost", "currency", "stock_status", "lead_time_hours", "minimum_quantity", "active", "revision", "created_at", "updated_at") VALUES
  ('9c5fe88e-4e42-4b3d-9cb3-c5e9a04716e0', '192b146e-180e-4557-aa9b-be6205c5edd9', '0114dec0-b547-4a98-9946-bd8113ff0c9b', 'OLD PRINCE GATO ADULTO EQUILIBRIUM X7.5KG', '46500.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-27T22:30:07.799Z'::timestamptz, '2026-08-27T22:30:07.799Z'::timestamptz),
  ('f6efdf77-4157-4b2b-bf45-1b819db982b4', '192b146e-180e-4557-aa9b-be6205c5edd9', '1a609cbc-2706-45f4-8de0-518d8c4313f2', 'EXCELLENT PUPPY POLLO Y ARROZ x15KG', '64400.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-27T22:30:07.796Z'::timestamptz, '2026-08-27T22:30:07.796Z'::timestamptz),
  ('90a0b8b7-fb05-4319-aefd-3fa7b7a1fde3', '192b146e-180e-4557-aa9b-be6205c5edd9', '52a3f9a1-2f1a-4bf9-b216-214dff4974d6', 'EXCELLENT ADULTO POLLO Y ARROZ x15KG', '58700.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-27T22:30:07.784Z'::timestamptz, '2026-08-27T22:30:07.784Z'::timestamptz),
  ('e809e3ed-14ee-4ef4-8543-5dc54aeccd9a', '192b146e-180e-4557-aa9b-be6205c5edd9', '6cb327e2-650f-4109-a120-760b3f1b118c', 'OLD PRINCE ADULT SMALL EQUILIBRIUM (P Y A) x15KG', '53500.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-27T22:30:07.802Z'::timestamptz, '2026-08-27T22:30:07.802Z'::timestamptz),
  ('b5544cb2-cd06-48ed-bd6a-3bdbf6e7901b', '192b146e-180e-4557-aa9b-be6205c5edd9', 'a34cd0ec-e2fd-4c4b-abb3-710f11109c8a', 'EXCELLENT ADULTO SMALL x15KG', '61200.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-27T22:30:07.788Z'::timestamptz, '2026-08-27T22:30:07.788Z'::timestamptz),
  ('83432d2c-e8ad-4977-ba4e-a95517fa9815', '192b146e-180e-4557-aa9b-be6205c5edd9', 'd4355459-1a52-4de4-aa6e-7dcc2442e88e', 'EXCELLENT ADULTO x7,5KG', '52700.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-27T22:30:07.780Z'::timestamptz, '2026-08-27T22:30:07.780Z'::timestamptz),
  ('14071281-966c-42cc-bba2-faaf376910b4', '766bb960-e8bf-48fa-89da-d2a1560e1769', '1a609cbc-2706-45f4-8de0-518d8c4313f2', 'EXCELLENT Puppy 15', '66500.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:35:24.379Z'::timestamptz, '2026-08-25T12:35:24.379Z'::timestamptz),
  ('cfd351d0-fb7c-41c2-9f62-c70c2e2d2146', '766bb960-e8bf-48fa-89da-d2a1560e1769', '52a3f9a1-2f1a-4bf9-b216-214dff4974d6', 'EXCELLENT Adulto DOG 15', '60300.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:35:24.361Z'::timestamptz, '2026-08-25T12:35:24.361Z'::timestamptz),
  ('6a9d8920-5c2a-469b-bba2-cf63c449179d', '766bb960-e8bf-48fa-89da-d2a1560e1769', 'a34cd0ec-e2fd-4c4b-abb3-710f11109c8a', 'EXCELLENT Adulto DOG Raza Pequeña 15', '63200.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:35:24.371Z'::timestamptz, '2026-08-25T12:35:24.371Z'::timestamptz),
  ('fd090163-0ebd-4102-a153-71216047e006', '766bb960-e8bf-48fa-89da-d2a1560e1769', 'd4355459-1a52-4de4-aa6e-7dcc2442e88e', 'EXCELLENT CAT ADULTO 7,5', '54200.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:35:24.352Z'::timestamptz, '2026-08-25T12:35:24.352Z'::timestamptz),
  ('ac18feff-d394-4cba-b116-e91433102be1', 'a5728ebc-e014-4493-9bd4-8e2ad74c508c', '0114dec0-b547-4a98-9946-bd8113ff0c9b', 'OLD PRINCE GA TO ADUL TO 7.5KG', '41706.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:30:05.185Z'::timestamptz, '2026-08-25T12:30:05.185Z'::timestamptz),
  ('e02bea5d-aa16-45d7-b917-2256d22b50e2', 'a5728ebc-e014-4493-9bd4-8e2ad74c508c', '6cb327e2-650f-4109-a120-760b3f1b118c', 'OLD PRINCE PERRO ADUL TO PEQUEÑA 15KG', '49014.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:30:05.189Z'::timestamptz, '2026-08-25T12:30:05.189Z'::timestamptz),
  ('5f646aea-5258-4c32-ad0f-e152565d8fe6', 'a5728ebc-e014-4493-9bd4-8e2ad74c508c', 'a34cd0ec-e2fd-4c4b-abb3-710f11109c8a', 'EXCELLENT PERRO ADUL TO PEQUEÑA 15KG', '62412.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:30:05.181Z'::timestamptz, '2026-08-25T12:30:05.181Z'::timestamptz),
  ('6f961fa1-3fb2-4b07-be40-5c1035b8e9cf', 'a5728ebc-e014-4493-9bd4-8e2ad74c508c', 'd4355459-1a52-4de4-aa6e-7dcc2442e88e', 'EXCELLENT GA TO ADUL TO 7.5KG', '53865.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:30:05.177Z'::timestamptz, '2026-08-25T12:30:05.177Z'::timestamptz),
  ('1ded6623-9bfc-4ede-a64c-973975b5fc17', 'bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', '0114dec0-b547-4a98-9946-bd8113ff0c9b', 'OLD PRINCE GATO EQUILIBRIUM ADULTO X 7.5 KG', '39283.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:29:47.468Z'::timestamptz, '2026-08-25T12:29:47.468Z'::timestamptz),
  ('5a7718dc-fa66-46d2-8839-94624c8019c3', 'bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', '1a609cbc-2706-45f4-8de0-518d8c4313f2', 'EXCELLENT DOG PUPPY X 15 KG', '63649.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:29:47.450Z'::timestamptz, '2026-08-25T12:29:47.450Z'::timestamptz),
  ('0d163d0e-c091-425b-ac8c-628da5dcb3da', 'bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', '52a3f9a1-2f1a-4bf9-b216-214dff4974d6', 'EXCELLENT DOG ADULTO X 15 KG', '57714.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:29:47.384Z'::timestamptz, '2026-08-25T12:29:47.384Z'::timestamptz),
  ('683006ae-da72-450c-a92f-0153291117bf', 'bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', '6cb327e2-650f-4109-a120-760b3f1b118c', 'OLD PRINCE EQUILIBRIUM ADULTO SMALL X 15 KG', '46156.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:29:47.479Z'::timestamptz, '2026-08-25T12:29:47.479Z'::timestamptz),
  ('8dc623e4-ae4e-4378-8d7c-fc469ee99825', 'bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', '8e67c094-46cb-4ddc-950f-d9a6ae4d876a', 'OLD PRINCE EQUILIBRIUM ADULTO X 15 KG', '41243.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:29:47.473Z'::timestamptz, '2026-08-25T12:29:47.473Z'::timestamptz),
  ('74fc66b0-5f59-4957-8592-44153ba8f2d4', 'bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', '9eb96625-64b3-4af9-a141-d63954070a32', 'PRO PLAN ADULT DOG RAZA MEDIANA 12KG', '76991.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:29:47.483Z'::timestamptz, '2026-08-25T12:29:47.483Z'::timestamptz),
  ('09d1ecba-0bdf-4bfa-960a-86cb6b7211e8', 'bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', 'a34cd0ec-e2fd-4c4b-abb3-710f11109c8a', 'EXCELLENT DOG ADULTO SMALL X 15 KG', '60139.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 1, '2026-08-25T12:29:47.392Z'::timestamptz, '2026-08-25T12:29:47.392Z'::timestamptz),
  ('9ec48a19-bf3e-48e7-af35-506bc28e3f74', 'bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', 'd4355459-1a52-4de4-aa6e-7dcc2442e88e', 'EXCELLENT CAT ADULTO X 7.5 KG', '52151.00', 'ARS', 'UNKNOWN', NULL, 1, TRUE, 2, '2026-08-25T12:29:47.378Z'::timestamptz, '2026-08-26T01:48:00.384Z'::timestamptz),
  ('8d08000e-3579-47f1-a4b3-7f62fa6ec035', 'bcd3b7ea-d7f9-4886-9e48-9b27e0c74814', 'f675f328-0554-4471-ab59-bc9609e98a38', NULL, '27860.00', 'ARS', 'AVAILABLE', NULL, 1, TRUE, 1, '2026-08-26T23:59:33.884Z'::timestamptz, '2026-08-26T23:59:33.884Z'::timestamptz)
ON CONFLICT ("id") DO UPDATE SET
  "supplier_id" = EXCLUDED."supplier_id",
  "variant_id" = EXCLUDED."variant_id",
  "supplier_sku" = EXCLUDED."supplier_sku",
  "unit_cost" = EXCLUDED."unit_cost",
  "currency" = EXCLUDED."currency",
  "stock_status" = EXCLUDED."stock_status",
  "lead_time_hours" = EXCLUDED."lead_time_hours",
  "minimum_quantity" = EXCLUDED."minimum_quantity",
  "active" = EXCLUDED."active",
  "revision" = EXCLUDED."revision",
  "created_at" = EXCLUDED."created_at",
  "updated_at" = EXCLUDED."updated_at";


UPDATE "product_variants" SET "preferred_supplier_offer_id" = '0d163d0e-c091-425b-ac8c-628da5dcb3da' WHERE "id" = '52a3f9a1-2f1a-4bf9-b216-214dff4974d6';
UPDATE "product_variants" SET "preferred_supplier_offer_id" = '8d08000e-3579-47f1-a4b3-7f62fa6ec035' WHERE "id" = 'f675f328-0554-4471-ab59-bc9609e98a38';
UPDATE "product_variants" SET "preferred_supplier_offer_id" = '74fc66b0-5f59-4957-8592-44153ba8f2d4' WHERE "id" = '9eb96625-64b3-4af9-a141-d63954070a32';
UPDATE "product_variants" SET "preferred_supplier_offer_id" = '9ec48a19-bf3e-48e7-af35-506bc28e3f74' WHERE "id" = 'd4355459-1a52-4de4-aa6e-7dcc2442e88e';
UPDATE "product_variants" SET "preferred_supplier_offer_id" = 'e02bea5d-aa16-45d7-b917-2256d22b50e2' WHERE "id" = '6cb327e2-650f-4109-a120-760b3f1b118c';
UPDATE "product_variants" SET "preferred_supplier_offer_id" = '1ded6623-9bfc-4ede-a64c-973975b5fc17' WHERE "id" = '0114dec0-b547-4a98-9946-bd8113ff0c9b';
UPDATE "product_variants" SET "preferred_supplier_offer_id" = '8dc623e4-ae4e-4378-8d7c-fc469ee99825' WHERE "id" = '8e67c094-46cb-4ddc-950f-d9a6ae4d876a';
UPDATE "product_variants" SET "preferred_supplier_offer_id" = '5a7718dc-fa66-46d2-8839-94624c8019c3' WHERE "id" = '1a609cbc-2706-45f4-8de0-518d8c4313f2';
UPDATE "product_variants" SET "preferred_supplier_offer_id" = '09d1ecba-0bdf-4bfa-960a-86cb6b7211e8' WHERE "id" = 'a34cd0ec-e2fd-4c4b-abb3-710f11109c8a';

COMMIT;

