# AGENTS.md

API NestJS organizada como monolito modular. Prisma administra exclusivamente las tablas propias de la aplicación sobre PostgreSQL; Supabase aporta inicialmente PostgreSQL, Auth y Storage mediante adapters sustituibles.

## Reglas arquitectónicas

## Modo de trabajo con el usuario

- Por defecto, no ejecutar comandos, migraciones, tests, builds, despliegues, llamadas externas ni acciones sobre servicios.
- Ante un error o una tarea operativa, explicar primero qué está ocurriendo, qué debe hacerse y cómo verificarlo.
- Si hace falta información para analizar, pedir al usuario el comando concreto que debe ejecutar y la salida relevante que debe compartir.
- Ejecutar acciones solamente cuando el usuario lo autorice de forma explícita en el mensaje actual.
- No interpretar una solicitud de análisis, explicación o diagnóstico como autorización para modificar archivos o ejecutar verificaciones.
- Al proponer comandos, indicar si son de lectura, modifican archivos, alteran infraestructura o pueden afectar datos.

- `domain` y `application` no importan NestJS, Prisma, Supabase ni SDKs externos.
- `presentation` invoca casos de uso; los casos de uso dependen de ports/repositories; infrastructure implementa esos contratos.
- Prisma solo se usa en `src/infrastructure`, persistencia concreta, `prisma/` y scripts operativos.
- Los modelos Prisma nunca se devuelven fuera de infrastructure; siempre se convierten con mappers.
- Supabase Auth utiliza `SupabaseAuthClient` con publishable key. Storage y futuras operaciones privilegiadas utilizan un `SupabaseAdminClient` distinto con secret key.
- Las entidades propias usan UUID internos. Los IDs de proveedores se guardan en `external_identities`.
- Los tests viven únicamente en `tests/unit`, `tests/integration` o `tests/e2e`.

## Base de datos y seguridad

- `prisma/migrations` es la única fuente de verdad para tablas propias.
- `pnpm db:migrate -- --name <cambio>` solo se ejecuta contra Supabase/PostgreSQL local.
- Producción solo ejecuta `pnpm db:deploy` desde CI/CD.
- No utilizar `prisma db push`, `supabase db push` ni cambios manuales del schema para tablas propias.
- No ejecutar `infra:reset` o `db:reset` sin autorización explícita; ambos destruyen datos locales.
- Nunca copiar credenciales productivas a archivos `.env` locales ni exponer secret keys en logs.
- No compilar frontend salvo instrucción explícita.

## Extensión

Cada feature nueva se agrega en `src/modules/<feature>` con `domain`, `application`, `infrastructure` y `presentation`. Los nuevos proveedores globales se implementan en `src/infrastructure` detrás de ports de `src/shared/application/ports` o ports propios del módulo.

## Fronteras de infraestructura

- Seguir siempre `controller -> use case -> port/repository -> adapter -> proveedor`.
- Las superficies Public, Customer y Admin comparten dominio y casos de uso; no duplicar módulos por superficie.
- Toda ruta HTTP, incluida OpenAPI, debe exponerse bajo `/api/v1`; no crear endpoints sin versión.
- `@supabase/supabase-js` solo puede importarse dentro de adapters concretos bajo `src/infrastructure/**/supabase`.
- Auth depende exclusivamente de `IdentityProvider`; ningún guard, controller o caso de uso puede inyectar clientes Supabase.
- Storage depende exclusivamente de `StorageProvider`; el cliente administrativo con secret key permanece aislado en su adapter.
- Prisma solo puede importarse en infraestructura de base de datos, repositorios/mappers concretos, `prisma/` y scripts operativos.
- No crear repositorios CRUD genéricos ni ports que reflejen métodos de un SDK. Los contratos expresan operaciones del negocio.
- Las transacciones concretas se encapsulan en infrastructure y no exponen tipos Prisma a application.
- No crear adapters ni abstracciones para capacidades futuras hasta que exista un caso de uso real.
- La referencia completa de arquitectura está en `docs/architecture.md` y se actualiza antes de introducir una nueva superficie o proveedor.
