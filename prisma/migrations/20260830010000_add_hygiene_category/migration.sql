INSERT INTO "categories" ("id", "name", "slug", "display_order", "active")
VALUES (
    '10000000-0000-4000-8000-000000000008',
    'Higiene',
    'higiene',
    50,
    true
)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name",
    "display_order" = EXCLUDED."display_order",
    "active" = true;
