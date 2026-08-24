# Arquitectura de Patitas API

Patitas API es un monolito modular NestJS con tres superficies HTTP. Las
superficies no son aplicaciones distintas: reutilizan los mismos módulos de
dominio y casos de uso, y cambian únicamente sus controllers, DTOs y permisos.

```text
Patitas API
│
├── Public API
│   ├── /api/v1/products
│   ├── /api/v1/categories
│   ├── /api/v1/brands
│   ├── /api/v1/offers
│   ├── /api/v1/recently-viewed
│   ├── /api/v1/products/:slug/view
│   └── /api/v1/calculator/...
│
├── Customer API
│   ├── /api/v1/me
│   ├── /api/v1/me/customer
│   ├── /api/v1/me/addresses
│   ├── /api/v1/me/orders
│   ├── /api/v1/cart
│   └── /api/v1/checkout
│
└── Admin API
    ├── /api/v1/admin/products
    ├── /api/v1/admin/products/:id/media
    ├── /api/v1/admin/products/:id/feeding-guide
    ├── /api/v1/admin/variants/:id/competitive-prices
    ├── /api/v1/admin/variants/:id/inventory
    ├── /api/v1/admin/categories
    ├── /api/v1/admin/brands
    ├── /api/v1/admin/suppliers
    ├── /api/v1/admin/pricing
    ├── /api/v1/admin/orders
    ├── /api/v1/admin/promotions
    ├── /api/v1/admin/coupons
    ├── /api/v1/admin/shipping-options
    ├── /api/v1/admin/carts/abandoned
    └── /api/v1/admin/products/:id/views
```

Los clientes viven en repositorios independientes y consumen el mismo contrato:

```text
Web pública Next.js ───────┐
Backoffice React/Next ─────┼──> Patitas API
App futura ────────────────┘
```

Todas las rutas HTTP, incluida la documentación OpenAPI, viven bajo el prefijo
versionado `/api/v1`. No se exponen aliases sin versión.

## Dirección de dependencias

```text
controller -> use case -> port/repository -> adapter -> proveedor
```

- `domain` contiene reglas, entidades y value objects.
- `application` orquesta casos de uso y depende de ports.
- `infrastructure` implementa ports con Prisma, Supabase u otra tecnología.
- `presentation` adapta HTTP a los casos de uso y aplica autenticación y roles.

No se permite invertir este flujo. Un controller no consulta Prisma; un caso de
uso no conoce Supabase; un modelo Prisma no sale del repositorio concreto.

La publicación de un producto es una invariante de aplicación: debe tener marca
y categoría activas, al menos una variante con SKU, precio positivo, una imagen
y fulfillment propio o de proveedor disponible. Las operaciones que podrían
romper esa condición la validan antes de persistir.

## Infraestructura reemplazable

### Auth

`IdentityProvider` es el contrato de aplicación. Inicialmente lo implementa
`SupabaseIdentityAdapter`, que es el único componente autorizado para usar el
cliente Supabase Auth. El módulo `auth`, sus guards y sus casos de uso reciben
tipos neutrales.

### Storage

`StorageProvider` es el contrato de aplicación. El adapter Supabase utiliza un
cliente administrativo aislado. La secret key nunca se entrega al cliente de
Auth ni se consume fuera del adapter de Storage.

El catálogo recibe por ahora una URL de media ya resuelta. La carga, firma o
reemplazo de archivos deberá pasar por `StorageProvider` cuando exista ese caso
de uso; ningún módulo de catálogo importará el cliente de Supabase Storage.

Los carritos y sesiones de checkout de invitados usan tokens opacos y almacenan
únicamente su hash. Las imágenes incluidas en carrito, checkout y últimos vistos
se resuelven mediante URLs firmadas de `StorageProvider`.

La confirmación del checkout es transaccional: recalcula precios, promociones,
envío e inventario, registra la reserva y convierte el carrito. El método
`SIMULATED_*` crea un pedido de demostración pagado. `MERCADO_PAGO` crea un
pedido `PENDING_PAYMENT`; el pedido solo pasa a pagado mediante webhook firmado.
No se almacenan datos de tarjetas.

Un carrito mantiene una única sesión de checkout. Crear una sesión es idempotente
por `cartId`: si el cliente abandonó el flujo antes de confirmar, se reutilizan
los datos ya guardados, se extiende la expiración y se rota el token temporal.
Así el cliente puede volver directamente al paso pendiente sin comenzar desde
cero. Un carrito ya convertido en pedido no puede reabrirse.

Los pagos, notificaciones y marketing están detrás de ports configurables. Las
zonas de envío se cotizan por código postal o barrio y los planes de reposición
solo generan carritos de recompra: nunca cobran automáticamente. Los jobs
externos usan `X-Cron-Secret` y los eventos de marketing se deduplican mediante
`eventName + eventId`.

### Persistencia

Cada módulo define repositorios orientados a su negocio. Prisma implementa esos
contratos en `infrastructure/persistence` y convierte siempre mediante mappers.
No se crea un repositorio CRUD genérico ni se expone una transacción Prisma a
application.

## Investigación externa de catálogo

La extracción de fabricantes y retails vive en `tools/catalog-research` como
CLI independiente. Produce snapshots JSON y no importa NestJS, Prisma ni
Supabase. El importador aprobado vive en `scripts/` y es el único componente
que persiste en PostgreSQL. Los precios de terceros se guardan como
`RetailPriceObservation`, separados de `SupplierOffer` y del precio de venta
propio de Patitas.

## Sustitución futura

La migración a infraestructura propia consiste en crear nuevas implementaciones
de `IdentityProvider`, `StorageProvider` o los repositorios, y cambiar sus
bindings de NestJS. Los contratos HTTP, entidades y casos de uso permanecen
inalterados. No se crearán abstracciones para proveedores que todavía no sean
necesarios.
