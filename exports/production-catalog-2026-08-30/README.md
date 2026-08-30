# Importación del catálogo en producción

Este paquete excluye los productos y marcas identificados inequívocamente como datos de prueba.

## 1. Preparación

- Aplicar primero todas las migraciones de Prisma en producción.
- Tomar un respaldo de la base productiva.
- Confirmar que el bucket privado `product-media` existe en Supabase Storage.
- Configurarlo con límite de 10 MB y MIME: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

## 2. Datos

El SQL es transaccional, conserva los UUID y restaura las ofertas preferidas después de crear las ofertas:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /Users/alejandrojesussojoruiz/projects/patitas-api/exports/production-catalog-2026-08-30/catalog-data.sql
```

Antes de ejecutarlo, `DATABASE_URL` debe apuntar explícitamente a producción. No se incluyen usuarios, pedidos ni datos de clientes.

## 3. Imágenes

Las rutas almacenadas en `product_media.url` son relativas al bucket y el SQL no contiene los binarios.
Las credenciales se pasan por variables de entorno y no deben guardarse en el repositorio:

```bash
export PRODUCTION_SUPABASE_URL="https://<proyecto>.supabase.co"
export PRODUCTION_SUPABASE_SECRET_KEY="<secret-key>"
pnpm catalog:copy-media -- --manifest=/Users/alejandrojesussojoruiz/projects/patitas-api/exports/production-catalog-2026-08-30/product-media-manifest.json --apply
```

El comando sin `--apply` verifica todos los objetos del origen y no escribe en producción. Usa `--overwrite` únicamente para reemplazar objetos que ya existan en el destino.
