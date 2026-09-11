CREATE SEQUENCE "orders_order_number_seq" START WITH 1000001;

ALTER TABLE "orders"
    ADD COLUMN "order_number" BIGINT;

WITH numbered AS (
    SELECT "id", (1000000 + ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id" ASC))::BIGINT AS "value"
    FROM "orders"
)
UPDATE "orders" AS orders
SET "order_number" = numbered."value"
FROM numbered
WHERE orders."id" = numbered."id";

SELECT setval(
    'orders_order_number_seq',
    COALESCE((SELECT MAX("order_number") FROM "orders"), 1000000),
    true
);

ALTER TABLE "orders"
    ALTER COLUMN "order_number" SET DEFAULT nextval('orders_order_number_seq'::regclass),
    ALTER COLUMN "order_number" SET NOT NULL;

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");

UPDATE "orders"
SET "number" = "order_number"::text;
