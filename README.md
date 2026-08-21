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

pnpm install
pnpm infra:start
pnpm db:deploy
pnpm db:seed
pnpm dev
```

`infra:start` levanta PostgreSQL, Auth y Storage con Supabase CLI/Docker y escribe `.env.supabase.local` con permisos restringidos. El script acepta las keys actuales del CLI y, por compatibilidad local, las keys legacy; la aplicación siempre recibe:

```text
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

El archivo generado no se versiona ni imprime secretos. Desarrollo nunca debe utilizar el proyecto Supabase de producción.

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

Las suites se centralizan en `tests/unit`, `tests/integration` y `tests/e2e`. Inicialmente pueden estar vacías.

## Producción, GitHub Actions y Vercel

En pull requests y pushes, GitHub Actions ejecuta `quality`. Solo un push a `main` puede ejecutar `migrate-production`, después de quality y dentro del environment protegido `production`.

Configura en GitHub:

- Environment `production` con reviewers obligatorios.
- Secret `DATABASE_URL` dentro de ese environment.

Preview Deployments no reciben la URL productiva ni ejecutan migraciones.

El despliegue productivo de Vercel queda pendiente hasta disponer del proyecto y sus secretos. No se debe habilitar una promoción productiva automática que compita con las migraciones. La cadena futura será:

```text
quality -> prisma migrate deploy -> Vercel production deploy
```

Al configurar Vercel, se debe elegir una de estas opciones:

1. Añadir un job `deploy-production` con dependencia de `migrate-production` y desplegar mediante Vercel CLI.
2. Configurar Vercel Deployment Checks para impedir promoción hasta que GitHub confirme quality y migraciones.

Los previews pueden continuar mediante la integración Git o un workflow separado, siempre sin migraciones productivas.
