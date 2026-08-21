# Patitas API

API NestJS con PostgreSQL, Prisma y adapters iniciales para Supabase Auth y Storage. El dominio y los casos de uso no dependen de NestJS, Prisma, Supabase ni otros proveedores.

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
    users/
      domain/
      application/
      infrastructure/
      presentation/
  infrastructure/
    config/
    database/
    identity/
    storage/
  shared/
    domain/
    application/
```

Flujo del módulo demostrativo:

```text
POST /users
  -> UsersController
  -> CreateUserUseCase
  -> UserRepository
  -> PrismaUserRepository
  -> PostgreSQL
```

El endpoint es una demostración pública de persistencia y no representa todavía el registro autenticado definitivo.

Ejemplo:

```bash
curl --request POST http://localhost:3000/users \
  --header 'content-type: application/json' \
  --data '{"email":"persona@example.com"}'
```

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
```

Los productos y variantes iniciales forman parte del estado versionado requerido y por eso se cargan mediante migraciones. `prisma db seed` queda reservado para datos locales descartables, como el usuario de demostración.

Las guardas rechazan `migrate dev`, `migrate reset` y `db seed` cuando `DATABASE_URL` no es loopback o `NODE_ENV=production`. `prisma db push` está bloqueado.

`infra:reset` elimina el volumen del proyecto Supabase local, vuelve a aplicar las migraciones y ejecuta el seed. Es destructivo y requiere autorización explícita antes de usarlo.

## Auth y Storage

- `IdentityProvider` se resuelve mediante `IDENTITY_PROVIDER` y usa `SupabaseAuthClient` con publishable key.
- `StorageProvider` se resuelve mediante `STORAGE_PROVIDER` y usa un `SupabaseAdminClient` separado con secret key.
- Ambos clientes deshabilitan persistencia de sesión, refresh automático y detección de sesión en URL.
- Storage asume buckets privados y expone `getSignedUrl`; una futura URL pública tendrá un contrato separado.

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
