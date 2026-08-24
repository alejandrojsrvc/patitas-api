# Investigación de catálogo

La CLI `catalog:research` vive fuera del runtime de NestJS y solo genera JSON.
No accede a Prisma, Supabase ni a la base de datos.

## Flujo

```text
manifest -> catalog:research -> JSON -> revisión -> aprobación -> catalog:research:import
```

Un manifest de marca puede declarar sus páginas de categorías. La CLI descubre
automáticamente las fichas de producto y las procesa en un único JSON.

Ejemplo:

```bash
pnpm catalog:research -- \
  tools/catalog-research/manifests/old-prince-pilot.json \
  artifacts/catalog-research/old-prince.json

pnpm catalog:research:import -- \
  artifacts/catalog-research/old-prince.json \
  artifacts/catalog-research/old-prince.approval.json \
  --dry-run
```

El importador requiere que el `runId` de la aprobación coincida con el resultado.
`--dry-run` valida el archivo y no conecta a PostgreSQL. Una importación real
queda protegida por `assertLocalDatabaseUrl`; producción debe recibir los cambios
mediante el flujo controlado de CI/CD.

## Datos y reglas

- El fabricante es la fuente canónica de nombre, descripción, ingredientes,
  composición, presentaciones y tabla de alimentación.
- Los retails solo generan observaciones históricas de precio y disponibilidad.
- Las variantes se emparejan por peso; los faltantes o bloqueos no valen cero.
- Los precios externos son admin-only y no reemplazan `salePrice`.
- Las imágenes se importan inicialmente como URLs de origen en `product_media`;
  el paso posterior de storage propio debe usar `StorageProvider`.
- No se usan credenciales, logins, CAPTCHA bypass ni migraciones automáticas.
