# Invalidación de caché del catálogo

La caché de catálogo vive en Next, por lo que el API la invalida mediante la
ruta interna del frontend:

```text
POST /api/internal/cache/catalog
x-catalog-cache-token: <CATALOG_CACHE_INVALIDATION_SECRET>
Content-Type: application/json
```

El secreto debe existir en el API y en Next con el mismo valor. Nunca debe
tener prefijo `NEXT_PUBLIC_` ni enviarse al navegador.

## Comando manual

El comando carga `.env.local` y usa `PUBLIC_WEB_URL` por defecto:

```bash
pnpm catalog:cache:clear -- --scope catalog
```

Para elegir explícitamente un entorno:

```bash
pnpm catalog:cache:clear -- --url http://localhost:3000 --scope catalog
pnpm catalog:cache:clear -- --url https://tienda.example.com --scope catalog
```

Ámbitos admitidos:

- `catalog`: listados y facetas.
- `products`: búsqueda, perros y gatos.
- `facets`: filtros.
- `product --slug <slug>`: listados, facetas y detalle del producto.
- `brand --slug <slug>`: listados, facetas y marca.
- `category --slug <slug>`: listados y facetas.
- `images`: listados; con `--slug` también invalida el detalle de ese producto.

El comando no imprime el token y la ruta responde `401` si falta o no coincide.
