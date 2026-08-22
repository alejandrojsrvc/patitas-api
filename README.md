# Patitas API

API NestJS con PostgreSQL, Prisma y adapters iniciales para Supabase Auth y Storage. El dominio y los casos de uso no dependen de NestJS, Prisma, Supabase ni otros proveedores.

La API expone superficies Public, Customer y Admin desde el mismo monolito
modular. La dirección de dependencias, las fronteras de proveedores y el camino
de migración a infraestructura propia se documentan en
[`docs/architecture.md`](docs/architecture.md).

## Requisitos

- Node.js 22
- pnpm 11.1.1
- Docker compatible
- `SUPABASE_DB_MAJOR_VERSION` igual a la versión mayor del PostgreSQL de Supabase Cloud

Consulta la versión Cloud antes del primer arranque:

```sql
SHOW server_version;
```

No existe un valor por defecto deliberadamente: el PostgreSQL local debe reproducir la versión mayor de producción.

## Primer arranque local

```bash
cp .env.example .env.local
# Completar únicamente SUPABASE_DB_MAJOR_VERSION

make bootstrap
pnpm dev
```

La versión mayor se obtiene desde Supabase Cloud con `SHOW server_version;`. El proyecto Cloud actual usa PostgreSQL 17, por lo que el entorno local utiliza `SUPABASE_DB_MAJOR_VERSION=17`. Si Cloud cambia de versión, este valor también debe actualizarse.

`infra:start` levanta el stack oficial mediante Supabase CLI y Docker. Supabase no es una única imagen: la CLI coordina PostgreSQL, Auth, Storage, REST, Realtime, Studio y los servicios auxiliares. No se mantiene un `docker-compose.yml` paralelo porque duplicaría y podría desalinear la configuración oficial de `supabase/config.toml`.

Servicios principales:

| Servicio        | Dirección local          |
| --------------- | ------------------------ |
| API Supabase    | `http://127.0.0.1:54321` |
| PostgreSQL      | `127.0.0.1:54322`        |
| Supabase Studio | `http://127.0.0.1:54323` |

Consulta el estado sin imprimir credenciales:

```bash
make infra-status
docker ps --filter name=patitas-api
```

El arranque escribe `.env.supabase.local` con permisos restringidos. El script acepta las keys actuales del CLI y, por compatibilidad local, las keys legacy; la aplicación siempre recibe:

```text
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

El archivo generado no se versiona ni imprime secretos. Desarrollo nunca debe utilizar el proyecto Supabase de producción.

Para detener el entorno conservando sus volúmenes:

```bash
make infra-down
```

## Arquitectura

```text
src/
  modules/
    auth/
      domain/
      application/
      infrastructure/
      presentation/
    users/
      domain/
      application/
      infrastructure/
      presentation/
    catalog/
    suppliers/
    pricing/
    customers/
    cart/
    checkout/
    promotions/
    shipping/
    analytics/
  infrastructure/
    config/
    database/
    identity/
    storage/
  shared/
    domain/
    application/
```

Flujo general:

```text
controller -> use case -> port/repository -> adapter -> proveedor
```

El registro y login pasan por `IdentityProvider`; los usuarios internos se
vinculan mediante `external_identities`. El endpoint público demostrativo
`POST /users` fue retirado.

## Prisma y migraciones

`prisma/migrations` es la única fuente de verdad para tablas propias. Supabase CLI no crea ni aplica migraciones o seeds de aplicación.

```bash
# Tras modificar schema.prisma, solo contra PostgreSQL local
pnpm db:migrate -- --name nombre_del_cambio
pnpm db:generate

# Bootstrap local y producción/CI
pnpm db:deploy

# Solo datos descartables locales
pnpm db:seed
```

La cadena inicial se aplica en este orden:

```text
20260818000000_catalog_schema
  -> products y product_variants
20260818001000_catalog_products
  -> 20 productos iniciales con UUID v4
20260818002000_catalog_product_variants
  -> 36 variantes iniciales y sus relaciones
20260821000000_init
  -> users y external_identities
20260821010000_commercial_foundation
  -> roles, catálogo normalizado, proveedores y pricing versionado
20260822010000_public_catalog_foundation
  -> taxonomía pública, media, calculadora e inventario
20260822020000_public_catalog_integrity
  -> integridad entre productos, variantes y media
20260822030000_backoffice_operations
  -> operaciones administrativas, inventario, pedidos y auditoría
20260822040000_customer_ecommerce
  -> direcciones, carritos, checkout, promociones, envíos y métricas públicas
```

Los productos y variantes iniciales forman parte del estado versionado requerido y por eso se cargan mediante migraciones. `prisma db seed` queda reservado para datos locales descartables, como el usuario de demostración.

Las guardas rechazan `migrate dev`, `migrate reset` y `db seed` cuando `DATABASE_URL` no es loopback o `NODE_ENV=production`. `prisma db push` está bloqueado.

`infra:reset` elimina el volumen del proyecto Supabase local, vuelve a aplicar las migraciones y ejecuta el seed. Es destructivo y requiere autorización explícita antes de usarlo.

## Auth y Storage

- `IdentityProvider` se resuelve mediante `IDENTITY_PROVIDER` y usa `SupabaseAuthClient` con publishable key.
- `StorageProvider` se resuelve mediante `STORAGE_PROVIDER` y usa un `SupabaseAdminClient` separado con secret key.
- Ambos clientes deshabilitan persistencia de sesión, refresh automático y detección de sesión en URL.
- Storage asume buckets privados y expone `getSignedUrl`; una futura URL pública tendrá un contrato separado.
- Ningún módulo de negocio consume clientes Supabase directamente. Auth usa
  `IdentityProvider` y Storage usa `StorageProvider`.

Superficies disponibles en este hito:

```text
PUBLIC:   GET /api/v1/products, /api/v1/products/:slug,
          /api/v1/categories, /api/v1/brands, /api/v1/offers,
          /api/v1/recently-viewed; POST /api/v1/products/:slug/view,
          POST /api/v1/calculator/food-duration
CUSTOMER: GET/PATCH /api/v1/me/customer, /api/v1/me/addresses,
          /api/v1/me/orders, /api/v1/cart, /api/v1/checkout
ADMIN:    /api/v1/admin/products, /api/v1/admin/categories,
          /api/v1/admin/brands, /api/v1/admin/suppliers,
          /api/v1/admin/supplier-offers, /api/v1/admin/pricing,
          /api/v1/admin/orders, /api/v1/admin/promotions,
          /api/v1/admin/coupons, /api/v1/admin/shipping-options,
          /api/v1/admin/carts/abandoned, /api/v1/admin/products/:id/views
```

`POST /api/v1/checkout/sessions` es idempotente por carrito. Si el cliente
abandona antes de confirmar el pago, la siguiente llamada recupera la sesión,
conserva contacto, dirección, envío y cupón, y devuelve un nuevo token temporal.

Swagger se publica en `/api/v1/docs` y `/api/v1/docs-json` fuera de producción.

El detalle de checkout, pagos, cobertura, recompra, consentimiento, jobs,
marketing, combos y referidos está en [`docs/backend-handoff.md`](docs/backend-handoff.md).

El primer ADMIN debe registrarse normalmente y luego promoverse mediante una
operación explícita:

```bash
pnpm user:grant-admin -- --email persona@example.com
```

En producción el comando exige repetir el email mediante `--confirm`.

Para sustituir Supabase, agrega otro adapter y cambia el binding del token en el módulo de infraestructura. Los casos de uso no cambian.

## Tests y validación

```bash
pnpm format:check
pnpm lint:check
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
```

El atajo equivalente es:

```bash
make check
```

Las suites se centralizan en `tests/unit`, `tests/integration` y `tests/e2e`. Inicialmente pueden estar vacías.

## Producción, GitHub Actions y Vercel

En pull requests y pushes, GitHub Actions ejecuta `quality`. Solo un push a `main` puede ejecutar el release productivo, después de quality y dentro del environment protegido `production`.

Configura en GitHub:

- Environment `production` con reviewers obligatorios.
- Secrets `DATABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` dentro de ese environment.

Preview Deployments no reciben la URL productiva ni ejecutan migraciones.

La integración Git de Vercel debe permanecer desconectada para evitar despliegues paralelos. El workflow aplica esta cadena:

```text
quality -> prisma migrate deploy -> Vercel production deploy
```

El `DATABASE_URL` de GitHub Actions usa conexión directa o Session Pooler (`5432`) para migraciones. El runtime de Vercel usa Transaction Pooler (`6543`). Los previews son manuales y requieren infraestructura aislada; nunca reciben la base productiva.

## Comandos Make

```bash
make help
make bootstrap
make infra-status
make db-status
make db-migrate name=add_example
make check
make dev
```

Los comandos destructivos (`infra:reset` y `db:reset`) se mantienen fuera del Makefile deliberadamente y requieren autorización explícita.
