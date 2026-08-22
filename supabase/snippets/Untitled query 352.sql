UPDATE product_variants pv
  SET
    sale_price = CASE
      WHEN weight_grams <= 1000 THEN 1990
      WHEN weight_grams <= 3000 THEN 4990
      WHEN weight_grams <= 7500 THEN 9990
      WHEN weight_grams <= 15000 THEN 17990
      ELSE 24990
    END,
    revision = revision + 1
  FROM products p
  WHERE pv.product_id = p.id
    AND p.status = 'ACTIVE'
    AND pv.active = true
    AND pv.sku IS NOT NULL;