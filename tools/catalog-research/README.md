# Catalog research CLI

CLI independiente para extraer fichas de fabricantes y observaciones públicas de
retails. No importa NestJS, Prisma ni Supabase y no escribe en la base de datos.

También acepta un manifest de marca: visita sus categorías, descubre las fichas
de producto y genera un único JSON sin cargar cada producto manualmente.

El JSON de marca contiene únicamente la URL de origen, nombre, presentaciones,
ingredientes, composición analítica, tabla diaria e imagen principal.

```bash
pnpm catalog:research -- \
  tools/catalog-research/manifests/old-prince-brand.json \
  artifacts/catalog-research/old-prince.json
```

```bash
pnpm catalog:research -- tools/catalog-research/manifests/old-prince-pilot.json artifacts/catalog-research/old-prince.json
```

El extractor usa `fetch` y HTML/JSON-LD. Para sitios que requieran renderizado,
se puede habilitar el renderer opcional con `CATALOG_RESEARCH_USE_BROWSER=1` si
Playwright y Chromium están instalados. Un bloqueo o una página sin precio queda
en el reporte; nunca se inventa un valor.
