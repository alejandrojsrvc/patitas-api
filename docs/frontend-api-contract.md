# Contrato API para la optimización de Patitas Web

Este documento describe los read models que debe consumir la Web. Los importes
monetarios son strings decimales y las respuestas privadas nunca incluyen
access tokens, refresh tokens, costos de proveedores ni reglas internas.

## Shell compartido

`GET /api/v1/storefront/bootstrap` acepta opcionalmente `Authorization` y
`X-Cart-Token`. Devuelve directamente:

```ts
type StorefrontShell = {
  viewer:
    | { authenticated: false }
    | {
        authenticated: true;
        id: string;
        email: string;
        displayName: string;
        role: string;
      };
  location: {
    label: string;
    street: string;
    number: string;
    apartment: string | null;
    city: string;
    province: string;
    postalCode: string;
  } | null;
  cart: {
    id: string | null;
    itemCount: number;
    subtotal: string;
    currency: 'ARS';
  };
};
```

Es una lectura pura: no crea carrito, no fusiona carritos y no ejecuta tareas
de mantenimiento.

## Carrito

`GET /api/v1/cart/bootstrap` devuelve:

```ts
type CartScreen = {
  shell: StorefrontShell;
  cart: Cart | null;
};
```

No crea un carrito si no existe. `PUT /cart/items/:variantId` y
`DELETE /cart/items/:variantId` continúan devolviendo el carrito completo.

`POST /api/v1/cart/merge` es idempotente, requiere autenticación y recibe
`{ cartToken }`. Una respuesta exitosa conserva todos los campos del carrito y
agrega `cartMerged: true`. Sólo entonces el BFF debe borrar su cookie anónima.

## Cuenta

`GET /api/v1/me/account` devuelve `{ shell, profile, section }` y acepta:

- `section=overview`: `orderCount` y hasta 3 `recentOrders`.
- `section=orders&page=1&perPage=10`: lista paginada y `meta`.
- `section=orders&orderId=<uuid>`: únicamente `{ type: "order-detail", order }`.
- `section=addresses`: direcciones.
- `section=pets`: mascotas.
- `section=replenishments`: reposiciones.

La pantalla no necesita solicitar además `/auth/me`, `/me/customer`, carrito o
dirección predeterminada.

Los elementos de la lista de pedidos son proyecciones livianas: id, número,
estado, estado de pago, total, moneda, cantidad de líneas y fecha. Las líneas y
datos completos sólo aparecen en `order-detail`.

## Checkout

`GET /api/v1/checkout/sessions/:id/bootstrap` devuelve:

```ts
type CheckoutScreen = {
  shell: StorefrontShell;
  session: CheckoutSession;
  shippingOptions: PublicShippingOption[];
  paymentMethods: PaymentMethod[];
  savedAddresses: Address[];
};
```

Las siguientes mutaciones devuelven siempre
`{ session, shippingOptions }`:

- `PATCH /checkout/sessions/:id/contact`
- `PATCH /checkout/sessions/:id/shipping-address`
- `PATCH /checkout/sessions/:id/shipping-option`
- `POST /checkout/sessions/:id/coupon`
- `DELETE /checkout/sessions/:id/coupon`
- `PATCH /checkout/sessions/:id/payment-method`

Al guardar una dirección, si existe una sola opción de envío y no requiere
elegir entre varios turnos, el API la selecciona dentro de la misma operación.

Un conflicto recuperable responde `409` con el envelope normal de error y:

```ts
currentState: {
  session: CheckoutSession;
  shippingOptions: PublicShippingOption[];
}
```

Una compra programada se configura con `POST
/api/v1/checkout/sessions/:id/purchase-schedule` o su equivalente móvil bajo
`/api/v1/mobile/checkout/sessions/:id/purchase-schedule`. Acepta `enabled` y,
cuando está activa, `frequencyDays` de 7, 14, 21 o 30. La respuesta informa
el descuento y los días de anticipación configurados. El checkout devuelve
`scheduledPurchase`; no se combinan cupones con una compra programada.

`GET /api/v1/me/purchase-schedules` y `POST
/api/v1/me/purchase-schedules/:id/prepare-checkout` permiten listar y preparar
una reposición pendiente de confirmación. La compra recurrente nunca se cobra
sin que el cliente confirme el checkout preparado.

La calculadora pública usa `POST /api/v1/replenishment-estimates`. Si no hay
sesión devuelve un `accessToken` para conservar el cálculo sin exponer datos de
cliente. El navegador debe enviarlo como `X-Replenishment-Token` al crear o
consultar el aviso en `POST /api/v1/replenishment-reminders`; el aviso exige
consentimiento explícito, email y versión del consentimiento.

## Pricing y beneficios del checkout

El checkout devuelve `pricing` y `actions` en la respuesta de sesión. `pricing`
se calcula en backend e informa descuentos de productos, medio de pago y
envío, además de `benefits` aplicados y `conflicts` explicables. `actions.coupon`
indica si el cupón puede aplicarse y, si no, devuelve `reasonCode` y `message`.
El frontend no debe reconstruir estas reglas.

La compra programada y las promociones automáticas de productos/orden no se
acumulan. La compra programada sí puede acumularse con transferencia, crédito y
beneficios de envío. Un cupón compatible sí puede acumularse con transferencia
y envío gratis. Si se intenta aplicar un cupón con compra programada activa,
`POST /api/v1/checkout/sessions/:id/coupon` responde conflicto inmediatamente;
la confirmación vuelve a validar todas las reglas.

La configuración administrativa se consulta y modifica en
`GET/PATCH /api/v1/admin/purchase-schedules/configuration`, con `enabled`,
`discountPercent` y `leadDays`. Una configuración existente no se reemplaza
por seeds ni por inicializaciones. Las compras programadas ya creadas conservan
su porcentaje y anticipación como snapshot.

La transferencia aparece en `GET /api/v1/payments/methods` únicamente si está
habilitada y tiene datos bancarios configurados. Al confirmar un checkout con
`BANK_TRANSFER`, la orden queda `PENDING_PAYMENT`; el backend persiste el
intento, el importe esperado y su vencimiento, sin crear una captura pagada.
El resultado incluye `transfer` con `status`, `expectedAmount`, `expiresAt` e
`instructions`. El cliente puede consultar `GET /api/v1/payments/orders/:id/transfer`,
informar `POST /api/v1/payments/orders/:id/transfer/report` y cargar evidencia
en `POST /api/v1/payments/orders/:id/transfer/proof/upload`. La evidencia nunca
aprueba el pago.

Backoffice consulta `GET /api/v1/admin/payment-method-benefits/transfers` y
confirma con `POST /api/v1/admin/payment-method-benefits/transfers/:attemptId/confirm`.
Debe enviar el importe exacto esperado; la acción queda auditada. La
confirmación administrativa reutiliza el mismo proceso interno de aprobación
que una notificación de proveedor externo.

Las órdenes exponen `benefits`, cada uno con tipo, alcance, origen, descripción,
porcentaje y monto, para conservar el desglose de pricing usado al confirmar.

## Catálogo

`GET /api/v1/products` devuelve únicamente resultados y paginación. La
ordenación por precio se pagina en PostgreSQL y no descarga el catálogo para
ordenarlo en memoria.

`GET /api/v1/products/autocomplete?q=<prefijo>` y
`GET /api/v1/mobile/products/autocomplete?q=<prefijo>` devuelven como máximo
ocho coincidencias compactas, una por variante vendible. Con menos de dos
caracteres devuelven `{ items: [] }` sin consultar el catálogo.

Cada elemento contiene `id` de variante, `productId`, `slug`, `name`,
`presentation`, `displayName`, marca resumida, imagen principal, `salePrice` y
`currency: "ARS"`. La imagen es una URL pública estable de `product-media`.
Estas respuestas no incluyen promociones, fulfillment, stock detallado ni el
resto de variantes del producto.

`GET /api/v1/products/facets` recibe los mismos parámetros de contexto,
especialmente `category` y `species`, y devuelve las opciones posibles para
ese universo de productos. Cada opción contiene `value`, `label` y `count`;
no se incluyen opciones cuyo conteo sea cero. Marcas incluyen `logoUrl`,
categorías conservan la jerarquía e incluyen `species`, y pesos utilizan gramos
como `value`.

Proyecciones livianas:

- `GET /api/v1/products/projections/calculator`
- `GET /api/v1/products/projections/sitemap`

El detalle de producto ya contiene `relatedProducts` y debe ser su única
fuente de relacionados.

Las imágenes y logos comerciales se entregan mediante URLs públicas estables
del bucket `product-media`. La Web puede usar optimización responsive y caché
de CDN sin coordinar su TTL con una firma. Esta política no aplica a documentos
de clientes, comprobantes ni archivos administrativos, que permanecen
privados.

Las respuestas públicas usan caché HTTP corta para precio, disponibilidad y
entrega, y caché larga para categorías, marcas, proyecciones e imágenes. El
carrito, checkout, cuenta y pedidos siempre usan `no-store`. El API vuelve a
validar precio, stock, descuentos y entrega en cada mutación.

## Autenticación y cookies

El API autentica y renueva tokens, pero no administra las cookies HTTP-only de
Next. El BFF es responsable de persistirlas. Después de login o registro
autenticado, el BFF puede invocar una sola vez `/cart/merge`; no debe borrar la
cookie anónima si esa operación falla.

## Caché y privacidad

- Catálogo, marcas, categorías y metadata: caché pública por tags y TTL en Web.
- Shell, cuenta, carrito, checkout, pedidos y pagos: `no-store`.
- Mutaciones, precio final, stock, promociones y envío: autoridad del API.
- Ninguna respuesta privada debe guardarse en caché compartida.

Los fixtures de referencia viven en `docs/fixtures/frontend-api/`.
