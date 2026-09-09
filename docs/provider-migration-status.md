# Estado de migración de proveedores

Fecha de cierre de implementación: 2026-09-07.

## Alcance implementado

- PostgreSQL 17 local mediante `compose.yml`.
- MinIO local en `59000/59001`, con `product-media` público y `payment-proofs` privado.
- Cloudflare R2 continúa siendo el almacenamiento de producción.
- Selección explícita con `STORAGE_PROVIDER=minio|r2`.
- `MinioStorageAdapter` y `CloudflareR2StorageAdapter` separados; ambos reutilizan internamente el protocolo compatible con S3.
- Auth propio con Argon2id portable vía WebAssembly y JWT EdDSA.
- Refresh tokens opacos, hasheados, rotativos y con detección de reutilización por familia.
- Confirmación de correo, recovery e invitaciones administrativas de un solo uso.
- Logout actual, logout global y revocación al suspender usuarios o cambiar contraseña.
- Seed local para un administrador descartable y CLI de invitación administrativa para producción.
- Turnstile server-to-server, protección del origen de Cloudflare y cobertura equivalente para rutas web/mobile.
- Validación de firma real de JPEG, PNG, GIF, WebP y PDF antes de almacenar uploads.
- Raw body y ventana temporal para webhooks de pagos.
- Job autenticado para liberar reservas vencidas.
- Fingerprint obligatorio para idempotencia de refunds.
- Eliminación del SDK, CLI, adapters, scripts y configuración de runtime anteriores.

## Verificaciones realizadas antes de detener la ejecución

- `docker compose config --quiet`: correcto con la primera definición del stack.
- PostgreSQL 17 y MinIO iniciaron correctamente.
- Los buckets fueron creados y recibieron las políticas esperadas.
- Replay limpio de las 39 migraciones: correcto.
- Se corrigió `20260907010000_pet_shopping_context` para eliminar el índice `cart_items_cart_variant_key` como índice, no como constraint.
- `20260907020000_first_party_auth` se aplicó correctamente en el replay limpio.
- Generación de Prisma Client: correcta.
- Build NestJS: correcto antes del último ajuste que separó nominalmente R2 y MinIO.
- Seed local con el nuevo hash Argon2id WebAssembly: correcto.

## No verificado por pedido del usuario

No se ejecutaron más comandos después de solicitar detener toda ejecución. Por eso quedan pendientes:

- Build posterior a la separación final `CloudflareR2StorageAdapter`/`MinioStorageAdapter`.
- Formato y lint.
- Tests unitarios, integración y E2E.
- Test de integración nuevo de Auth/JWT.
- Test de integración nuevo de MinIO.
- Estado final de migraciones después de cualquier edición posterior.

## Configuración requerida

### Desarrollo

Usar los valores de `.env.dist`:

```text
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://127.0.0.1:59000
MINIO_REGION=us-east-1
MINIO_ACCESS_KEY_ID=minioadmin
MINIO_SECRET_ACCESS_KEY=minioadmin
MINIO_PUBLIC_BASE_URL=http://127.0.0.1:59000/product-media
```

`.env.local` contiene únicamente configuración local de PostgreSQL, MinIO, Auth y servicios descartables de desarrollo. Los secretos productivos se configuran fuera del repositorio.

### Producción

```text
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_BASE_URL=https://media.patitasinquietas.com.ar
DATABASE_URL=<Neon pooled>
DIRECT_DATABASE_URL=<Neon direct>
AUTH_JWT_PRIVATE_KEY_BASE64=<PKCS8 Ed25519 DER en base64>
AUTH_JWT_PUBLIC_KEY_BASE64=<SPKI Ed25519 DER en base64>
CLOUDFLARE_TURNSTILE_SECRET_KEY=...
CLOUDFLARE_TURNSTILE_HOSTNAMES=patitasinquietas.com.ar
ORIGIN_VERIFY_SECRET=...
```

## Pendientes externos al código

- Configurar Cloudflare para inyectar `X-Origin-Verify` al origen y bloquear acceso directo.
- Configurar reglas WAF/rate limiting y acciones Turnstile usadas por los clientes.
- Web/mobile deben enviar `X-Turnstile-Token` con las acciones `auth-register`, `auth-login`, `auth-password-recovery`, `auth-email-confirmation-resend` y `anonymous-checkout`.
- Confirmar que Payway firma `timestamp + "." + rawBody` y entrega `X-Payway-Timestamp`; de no ser así, adaptar exactamente al contrato oficial antes del cutover.
- Configurar el job `POST /api/v1/jobs/orders/expire-payment-reservations` con `X-Cron-Secret`.
- Crear credenciales R2 limitadas exclusivamente a `product-media` y `payment-proofs`.
- Configurar Neon pooled para runtime y Neon direct para migraciones.
- Implementar MFA/step-up administrativo antes de habilitar operaciones financieras reales.

## Validación sugerida

Estos comandos quedan documentados, no fueron ejecutados después de la orden de detener ejecuciones:

```bash
pnpm db:generate
pnpm db:validate
pnpm format:check
pnpm lint:check
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
```

No ejecutar `infra:reset` ni `db:reset` si existen datos locales que deban conservarse.
