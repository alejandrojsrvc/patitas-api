# Invalidación del caché del catálogo

Las páginas SEO se almacenan en Varnish. Cloudflare conserva TLS, WAF, proxy y caché de assets, pero el HTML queda fuera de su caché para mantener una sola capa documental invalidable por XKey.

El API purga Varnish mediante XKey. La integración de purge por Cache Tags de Cloudflare es opcional y sólo debe habilitarse si en el futuro se decide almacenar también HTML en el edge.

Las invalidaciones automáticas son best effort, se agrupan y respetan un intervalo mínimo de 12 segundos. El TTL de 15 minutos es la recuperación ante un fallo de purge.

## Variables

```dotenv
CATALOG_EDGE_CACHE_ENABLED=true
VARNISH_PURGE_URL=http://patitas-varnish:6081/_cache/xkey
VARNISH_PURGE_SECRET=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_CACHE_PURGE_TOKEN=
```

El secreto de Varnish debe coincidir con el del contenedor `patitas-varnish`. Las dos variables de Cloudflare son opcionales, pero deben configurarse juntas; si se usan, el token se limita a `Zone / Cache Purge / Purge` sobre la zona de Patitas.

Durante el rollout se despliega primero con `CATALOG_EDGE_CACHE_ENABLED=false`. Se cambia a `true` solamente después de probar Varnish.

## Comando manual

```bash
pnpm catalog:cache:purge -- --scope catalog
pnpm catalog:cache:purge -- --scope product --slug royal-canin-mini-adult
pnpm catalog:cache:purge -- --xkey product:royal-canin-mini-adult
pnpm catalog:cache:purge -- --xkey catalog:list --xkey catalog:home
pnpm catalog:cache:purge -- --dry-run --xkey catalog
```

`--xkey` puede repetirse. Las keys se normalizan a minúsculas, se deduplican y se validan antes de hacer llamadas externas. El comando retorna código distinto de cero si una capa configurada rechaza el purge y nunca imprime tokens.

## Mapeo automático

- Producto, variante, media, guía o inventario administrativo: ficha del producto, listados, home, sitemap y calculadora.
- Marca, categoría, promoción, fulfillment u oferta de proveedor: catálogo completo.
- Aplicación de un precio: fichas, listados, home, sitemap y calculadora.
- Cupones: no invalidan HTML público.
- Reservas y liberaciones normales de checkout: no invalidan por pedido; stock y totales se validan nuevamente en el backend.
