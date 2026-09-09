# Patitas API

API NestJS organizada como monolito modular. PostgreSQL y Prisma administran la persistencia, el auth usa credenciales propias con JWT EdDSA, producción almacena objetos en Cloudflare R2 y desarrollo usa MinIO.

## Requisitos

- Node.js 22
- pnpm 11.1.1
- Docker con Compose

## Primer arranque

```bash
cp .env.local.example .env.local
make bootstrap
pnpm dev
```

`make bootstrap` instala dependencias, inicia PostgreSQL 17 y MinIO, aplica las migraciones y crea el administrador local `admin@patitas.local`. La contraseña descartable se configura mediante `LOCAL_ADMIN_PASSWORD`.

| Servicio      | Dirección local          |
| ------------- | ------------------------ |
| PostgreSQL    | `127.0.0.1:54322`        |
| MinIO S3      | `http://127.0.0.1:59000` |
| MinIO Console | `http://127.0.0.1:59001` |

`product-media` es público. `payment-proofs` permanece privado y se entrega mediante URLs firmadas.

## Arquitectura

```text
controller -> use case -> port/repository -> adapter -> proveedor
```

- `domain` y `application` no importan NestJS, Prisma ni SDKs externos.
- Prisma se utiliza únicamente desde infraestructura de persistencia, `prisma/` y scripts operativos.
- Auth depende de `IdentityProvider`; los guards validan la sesión y obtienen el rol vigente desde PostgreSQL.
- Storage depende de `StorageProvider`; `STORAGE_PROVIDER=minio` selecciona MinIO y `STORAGE_PROVIDER=r2` selecciona Cloudflare R2. Ambos proveedores implementan internamente el protocolo S3.
- Todas las rutas HTTP se exponen bajo `/api/v1`.

La referencia completa está en [`docs/architecture.md`](docs/architecture.md).

## Auth

- Contraseñas hasheadas con Argon2id.
- Access tokens EdDSA de vida corta.
- Refresh tokens opacos, hasheados y rotados por familia.
- Reutilizar un refresh token revoca toda su familia.
- Confirmación, recovery e invitaciones usan tokens opacos de un solo uso.
- Logout, logout global y suspensión revocan sesiones en PostgreSQL.
- Los roles del JWT no se usan como fuente de autorización.

El seed local crea un ADMIN descartable. Para invitar un administrador en producción:

```bash
pnpm user:invite-production -- --email persona@example.com --confirm persona@example.com
```

## Migraciones

`prisma/migrations` es la única fuente de verdad.

```bash
# Sólo contra PostgreSQL local
pnpm db:migrate -- --name nombre_del_cambio
pnpm db:generate

# CI y despliegues
pnpm db:deploy
pnpm db:status
```

- `DATABASE_URL` apunta al endpoint pooled usado por el runtime.
- `DIRECT_DATABASE_URL` apunta a una conexión directa para Prisma CLI y CI.
- En local ambas variables apuntan al contenedor PostgreSQL.
- `prisma db push` está bloqueado.
- Reset, seed y `migrate dev` rechazan hosts no locales.

## Seguridad

Producción exige:

- API detrás del proxy de Cloudflare.
- `ORIGIN_VERIFY_SECRET` inyectado en el origen por Cloudflare.
- `CLOUDFLARE_TURNSTILE_SECRET_KEY` para Auth y checkout anónimo.
- `CLOUDFLARE_TURNSTILE_HOSTNAMES` con los hostnames frontend de ese despliegue; producción no debe incluir `localhost` ni `127.0.0.1`.
- Reglas WAF y rate limiting en Cloudflare, complementadas por límites internos.
- `STORAGE_PROVIDER=r2` y credenciales `R2_*` limitadas a los buckets de la aplicación.

Los clientes envían la respuesta de Turnstile mediante `X-Turnstile-Token`. Las acciones protegidas son `auth-register`, `auth-login`, `auth-password-recovery`, `auth-email-confirmation-resend` y `anonymous-checkout`; el widget debe usar la acción correspondiente. Los webhooks verifican firma, timestamp y raw body.

## Producción

Neon utiliza dos conexiones:

- GitHub Actions: `DIRECT_DATABASE_URL` no pooled para `prisma migrate deploy`.
- Vercel: `DATABASE_URL` pooled para el runtime.

El workflow productivo ejecuta `quality -> migrate deploy -> Vercel deploy` dentro del environment protegido `production`.

## Verificación

```bash
pnpm db:validate
pnpm format:check
pnpm lint:check
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
```

Los tests viven únicamente en `tests/unit`, `tests/integration` y `tests/e2e`.
