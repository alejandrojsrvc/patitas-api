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
    currency: "ARS";
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

## Catálogo

`GET /api/v1/products` devuelve únicamente resultados y paginación. La
ordenación por precio se pagina en PostgreSQL y no descarga el catálogo para
ordenarlo en memoria.

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
