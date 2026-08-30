# Endpoints necesarios para Patitas Mobile

Estado: contrato funcional propuesto para conectar la app móvil actual con el backend.

Este documento describe todos los datos que consume la experiencia navegable actual: autenticación, cuenta, mascotas, seguimiento de alimento, Inicio, Tienda, reposición, entrega, pago, pedidos y notificaciones.

Cuando este archivo y `BACKEND_API_CONTRACT.md` difieran, este documento representa las necesidades más recientes de Mobile. Se conservan las rutas que ya existen en `patitas-api` siempre que cubren el flujo.

## 1. Convenciones obligatorias

- Base URL: `/api/v1`.
- Autenticación: `Authorization: Bearer <accessToken>`.
- Las rutas `/me/*` obtienen el usuario desde el token; Mobile nunca envía un `customerId`.
- Fechas y horas: ISO 8601 con zona horaria. El backend debe devolver el instante y no textos como `mañana`.
- Dinero: string decimal más moneda, por ejemplo `"82400.00"` y `"ARS"`.
- Precios, stock, promociones, envío, disponibilidad, descuentos y total son autoritativos del backend.
- Las creaciones y confirmaciones sensibles aceptan `Idempotency-Key`.
- Las listas extensas responden `{ "items": [], "nextCursor": null }`.
- Los `PATCH` devuelven el recurso completo después de modificarlo.
- El backend no debe enviar símbolos `~` o `≈`. La incertidumbre se devuelve como rango o dato estimado y la app la comunica mediante copy.
- Consumo, logística y pago son ejes distintos. Una mascota puede tener `8` días restantes, un pedido `SHIPPED` y un pago `APPROVED` al mismo tiempo.

Formato común de error:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Revisá los datos ingresados.",
  "fieldErrors": {
    "weightKg": "Debe ser mayor que cero."
  },
  "details": null,
  "traceId": "req_123"
}
```

Códigos que la app necesita distinguir:

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `OUT_OF_STOCK`
- `PRICE_CHANGED`
- `DELIVERY_OPTION_CHANGED`
- `COUPON_INVALID`
- `COUPON_EXPIRED`
- `PAYMENT_REJECTED`
- `PAYMENT_PENDING`
- `CHECKOUT_EXPIRED`
- `CHECKOUT_CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

## 2. Resumen y estado de las rutas

Leyenda:

- `Existe`: la ruta ya está contemplada por el backend actual.
- `Ampliar`: existe, pero Mobile necesita campos o comportamiento adicional.
- `Nuevo`: la ruta todavía debe incorporarse.

| Prioridad | Estado  | Endpoint                                             | Uso principal                                  |
| --------- | ------- | ---------------------------------------------------- | ---------------------------------------------- |
| P0        | Existe  | `POST /auth/register`                                | Crear cuenta                                   |
| P0        | Existe  | `POST /auth/login`                                   | Iniciar sesión                                 |
| P0        | Existe  | `POST /auth/refresh`                                 | Renovar sesión                                 |
| P0        | Existe  | `GET /me`                                            | Usuario autenticado                            |
| P0        | Existe  | `GET/PATCH /me/customer`                             | Perfil de Cuenta                               |
| P0        | Existe  | `GET/POST/PATCH/DELETE /me/addresses`                | Direcciones y checkout                         |
| P0        | Ampliar | `GET/POST/PATCH /me/pets`                            | Mascotas, sexo, edad, foto y raza              |
| P1        | Nuevo   | `GET /pet-breeds`                                    | Selector cerrado de razas comunes              |
| P0        | Existe  | `GET /categories`                                    | Categorías de Tienda                           |
| P0        | Ampliar | `GET /products`                                      | Catálogo, búsqueda y disponibilidad contextual |
| P0        | Ampliar | `GET /products/:slug`                                | Producto y presentaciones                      |
| P0        | Existe  | `GET /offers`                                        | Beneficios y promociones visibles              |
| P0        | Existe  | `POST /replenishment-estimates`                      | Duración estimada                              |
| P0        | Ampliar | `GET/POST/PATCH /me/replenishment-plans`             | Seguimiento de consumo                         |
| P0        | Existe  | `POST /me/replenishment-plans/:id/recalibrate`       | Ajustar cuánto queda                           |
| P0        | Nuevo   | `POST /me/replenishment-plans/:id/change-product`    | Cambiar alimento                               |
| P0        | Nuevo   | `POST /me/replenishment-plans/:id/start-bag`         | Iniciar nueva bolsa                            |
| P0        | Ampliar | `POST /replenishment-plans/:id/reorder-cart`         | Reposición contextual nativa                   |
| P0        | Existe  | `POST /cart` y `GET /cart`                           | Borrador de compra                             |
| P0        | Ampliar | `PUT/DELETE /cart/items/:variantId`                  | Cantidades, extras y asociación con mascota    |
| P0        | Existe  | `POST /checkout/sessions`                            | Iniciar checkout                               |
| P0        | Existe  | `GET /checkout/sessions/:id`                         | Recuperar checkout y totales                   |
| P0        | Ampliar | `PATCH /checkout/sessions/:id/shipping-address`      | Dirección e instrucciones                      |
| P0        | Existe  | `GET /checkout/sessions/:id/shipping-options`        | Fechas y franjas disponibles                   |
| P0        | Existe  | `PATCH /checkout/sessions/:id/shipping-option`       | Seleccionar entrega                            |
| P0        | Existe  | `POST/DELETE /checkout/sessions/:id/coupon`          | Cupón y recálculo                              |
| P0        | Ampliar | `GET /payments/methods`                              | Métodos, disponibilidad y beneficios           |
| P1        | Nuevo   | `GET /me/payment-methods`                            | Tarjetas guardadas tokenizadas                 |
| P0        | Existe  | `PATCH /checkout/sessions/:id/payment-method`        | Elegir pago y recalcular                       |
| P0        | Existe  | `POST /checkout/sessions/:id/confirm`                | Crear pedido e iniciar pago                    |
| P0        | Existe  | `GET /payments/orders/:id/status`                    | Resolver pago pendiente o redirect             |
| P0        | Existe  | `GET /me/orders`                                     | Historial de pedidos                           |
| P0        | Ampliar | `GET /me/orders/:id`                                 | Detalle, timeline y entrega estimada           |
| P0        | Existe  | `GET /me/orders/pets/:petId/purchase-history`        | Compraste antes y aprendizaje                  |
| P0        | Existe  | `GET/PATCH /communications/notification-preferences` | Preferencias de avisos                         |
| P0        | Ampliar | `POST /communications/device-tokens`                 | Registrar push token                           |
| P1        | Nuevo   | `DELETE /communications/device-tokens/:id`           | Cerrar sesión o retirar dispositivo            |
| P1        | Nuevo   | `GET /me/notifications`                              | Bandeja de avisos dentro de la app             |
| P1        | Nuevo   | `PATCH /me/notifications/:id/read`                   | Marcar aviso leído                             |
| P1        | Nuevo   | `POST /me/notifications/read-all`                    | Marcar todos leídos                            |

## 3. Autenticación y cuenta

### `POST /auth/register`

Request:

```json
{
  "email": "milo@example.com",
  "password": "una-clave-segura",
  "fullName": "Alejandro"
}
```

Response `201`:

```json
{
  "user": {
    "id": "usr_123",
    "email": "milo@example.com",
    "fullName": "Alejandro",
    "avatarUrl": null
  },
  "session": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "2026-09-01T12:00:00Z"
  },
  "verificationRequired": false
}
```

Si hace falta verificar el email, `session` puede ser `null` y `verificationRequired` debe ser `true`.

### `POST /auth/login`

Request:

```json
{
  "email": "milo@example.com",
  "password": "una-clave-segura"
}
```

Response `200`: mismo objeto `user + session` de registro.

### `POST /auth/refresh`

Request:

```json
{ "refreshToken": "..." }
```

Response `200`:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": "2026-09-01T12:00:00Z"
}
```

### `GET /me`

Response `200`: usuario autenticado. Se usa para restaurar la sesión.

### `GET /me/customer`

Response `200`:

```json
{
  "id": "cus_123",
  "userId": "usr_123",
  "fullName": "Alejandro",
  "email": "milo@example.com",
  "phone": "+5491112345678",
  "avatarUrl": null
}
```

### `PATCH /me/customer`

Request parcial:

```json
{
  "fullName": "Alejandro Sojo",
  "phone": "+5491112345678",
  "avatarUrl": "https://cdn.example.com/avatar.jpg"
}
```

Response `200`: perfil completo actualizado.

## 4. Direcciones

Modelo de dirección:

```json
{
  "id": "addr_home",
  "label": "Casa",
  "recipientName": "Alejandro Sojo",
  "phone": "+5491112345678",
  "street": "Av. Corrientes",
  "number": "5200",
  "apartment": "4B",
  "city": "CABA",
  "province": "Buenos Aires",
  "postalCode": "C1414AJN",
  "reference": "Timbre 4B",
  "isDefault": true
}
```

### `GET /me/addresses`

Response `200`: array de direcciones. Solo una puede tener `isDefault: true`.

### `POST /me/addresses`

Request: modelo sin `id`. Response `201`: dirección creada.

### `PATCH /me/addresses/:addressId`

Request parcial. Para marcarla principal:

```json
{ "isDefault": true }
```

Response `200`: dirección completa actualizada.

### `DELETE /me/addresses/:addressId`

Response `204`. Si era la principal, el backend debe elegir otra o dejar todas en `false` de forma explícita.

## 5. Mascotas y referencias

### `GET /pet-breeds?species=dog&query=labrador`

Ruta nueva necesaria para que raza sea un listado provisto por nosotros y no texto libre.

Response `200`:

```json
{
  "items": [
    { "id": "labrador-retriever", "name": "Labrador retriever" },
    { "id": "mixed", "name": "Mestizo" },
    { "id": "unknown", "name": "No sé" }
  ],
  "nextCursor": null
}
```

### `GET /me/pets`

Response `200`:

```json
[
  {
    "id": "pet_milo",
    "name": "Milo",
    "species": "dog",
    "sex": "male",
    "birthDate": "2022-05-10",
    "age": {
      "value": 4,
      "unit": "years"
    },
    "weightKg": "18.00",
    "lifeStage": "adult",
    "breed": {
      "id": "mixed",
      "name": "Mestizo"
    },
    "avatarUrl": null,
    "createdAt": "2026-08-26T12:00:00Z",
    "updatedAt": "2026-08-29T12:00:00Z"
  }
]
```

Valores:

- `species`: `dog | cat`
- `sex`: `female | male`
- `lifeStage`: `puppy | adult | senior`
- `age.unit`: `months | years`

`birthDate` es preferible como fuente de verdad. `age` puede ser calculada por backend para rellenar el selector y evitar diferencias entre plataformas.

### `POST /me/pets`

Request:

```json
{
  "name": "Milo",
  "species": "dog",
  "sex": "male",
  "age": { "value": 4, "unit": "years" },
  "weightKg": "18.00",
  "lifeStage": "adult",
  "breedId": "mixed",
  "avatarUrl": null
}
```

Response `201`: mascota completa.

### `PATCH /me/pets/:petId`

Request parcial. Response `200`: mascota completa actualizada.

Campos que faltan en el contrato actual del backend y necesita la UI: `sex`, `birthDate/age`, `breedId` y `avatarUrl`.

## 6. Catálogo, categorías y promociones

### `GET /categories`

Response `200`:

```json
[
  { "id": "food", "slug": "alimento", "name": "Alimento", "sortOrder": 1 },
  { "id": "litter", "slug": "arena", "name": "Arena", "sortOrder": 2 },
  { "id": "snacks", "slug": "snacks", "name": "Snacks", "sortOrder": 3 },
  { "id": "hygiene", "slug": "higiene", "name": "Higiene", "sortOrder": 4 }
]
```

Regla de catálogo V1: solo consumibles que normalmente se terminan y vuelven a comprarse.

### `GET /products`

Queries soportadas:

- `query`: búsqueda por marca o producto.
- `category`: slug de categoría.
- `species`: `dog | cat`.
- `brand`: slug de marca.
- `featured`: boolean.
- `previouslyPurchased`: boolean para “Compraste antes”.
- `postalCode`: opcional; permite calcular disponibilidad hoy/mañana antes del checkout.
- `cursor` y `limit`.

Response `200`:

```json
{
  "items": [
    {
      "id": "prod_excellent_adult",
      "slug": "excellent-adult-medium-large",
      "brand": {
        "id": "brand_excellent",
        "name": "Excellent",
        "slug": "excellent"
      },
      "name": "Adult Medium & Large",
      "description": "Alimento completo para perros adultos.",
      "category": {
        "id": "food",
        "slug": "alimento",
        "name": "Alimento"
      },
      "species": "dog",
      "image": {
        "url": "https://cdn.example.com/products/excellent-15kg.png",
        "altText": "Bolsa de Excellent Adult Medium & Large"
      },
      "variants": [
        {
          "id": "var_excellent_15",
          "sku": "EXC-15",
          "presentation": "15 kg",
          "weightGrams": 15000,
          "salePrice": "82400.00",
          "compareAtPrice": null,
          "currency": "ARS",
          "fulfillment": {
            "status": "ON_REQUEST",
            "purchasable": true,
            "leadTimeHours": 24,
            "availability": "TOMORROW",
            "earliestDeliveryDate": "2026-08-30",
            "orderBefore": "10:00"
          }
        }
      ]
    }
  ],
  "nextCursor": null
}
```

Valores de fulfillment:

- `status`: `IN_STOCK | ON_REQUEST | OUT_OF_STOCK`
- `availability`: `TODAY | TOMORROW | OUT_OF_STOCK`
- `purchasable` decide si el botón Agregar/Sumar está habilitado.

Requisito importante: una variante `ON_REQUEST` con entrega mañana debe poder ser `purchasable: true`. La fecha definitiva se valida nuevamente en checkout.

### `GET /products/:slug`

Response `200`: producto completo con todas sus presentaciones, imágenes, precio y fulfillment por variante. La app agrupa 3 kg y 15 kg dentro del mismo producto.

### `GET /offers`

Response `200`:

```json
{
  "items": [
    {
      "id": "first-order-shipping",
      "type": "FREE_SHIPPING",
      "title": "Envío gratis",
      "description": "En tu primera compra",
      "appliesAutomatically": true,
      "startsAt": "2026-08-01T00:00:00Z",
      "endsAt": null
    },
    {
      "id": "bank-transfer-3",
      "type": "PAYMENT_METHOD_DISCOUNT",
      "title": "3% OFF",
      "description": "Pagando por transferencia",
      "percentage": "3.00",
      "appliesAutomatically": true,
      "startsAt": "2026-08-01T00:00:00Z",
      "endsAt": null
    }
  ],
  "nextCursor": null
}
```

El checkout vuelve a validar cualquier oferta; este endpoint sirve para comunicarla, no para calcular el total final.

## 7. Estimación y seguimiento de consumo

### `POST /replenishment-estimates`

Request:

```json
{
  "petId": "pet_milo",
  "variantId": "var_excellent_15",
  "bagStartedAt": "2026-08-20T10:00:00-03:00",
  "remainingBucket": "MORE_THAN_HALF"
}
```

También debe aceptar datos de mascota y alimento personalizado durante onboarding, antes de que existan `petId` o `variantId`.

Response `200`:

```json
{
  "id": "est_123",
  "dailyGrams": {
    "min": 360,
    "max": 400,
    "nominal": 380
  },
  "durationDays": {
    "min": 38,
    "max": 42,
    "nominal": 40
  },
  "estimatedDepletionAt": "2026-09-29T10:00:00-03:00",
  "source": "CALCULATED",
  "assumptions": ["Calculado según peso, etapa y presentación seleccionada."]
}
```

La UI muestra valores como `40 días estimados` o `380 g/día estimados`; no interpola símbolos.

Buckets permitidos:

- `ALMOST_FULL`
- `MORE_THAN_HALF`
- `ABOUT_HALF`
- `ALMOST_EMPTY`
- `FINISHED`

### `GET /me/replenishment-plans`

Response `200`:

```json
[
  {
    "id": "plan_milo_food",
    "petId": "pet_milo",
    "kind": "food",
    "product": {
      "id": "prod_excellent_adult",
      "name": "Excellent Adult Medium & Large"
    },
    "variant": {
      "id": "var_excellent_15",
      "presentation": "15 kg",
      "weightGrams": 15000
    },
    "consumption": {
      "status": "SOON",
      "estimatedDaysRemaining": 8,
      "estimatedDepletionAt": "2026-09-06T10:00:00-03:00",
      "dailyGrams": { "min": 360, "max": 400, "nominal": 380 },
      "startedAt": "2026-08-01T10:00:00-03:00",
      "remainingBucket": "ALMOST_EMPTY",
      "newBagPending": false
    },
    "reminders": {
      "enabled": true,
      "leadDays": 5,
      "channels": ["push", "email"]
    },
    "activeOrder": {
      "id": "ord_1043",
      "number": "1043",
      "fulfillmentStatus": "CONFIRMED"
    },
    "updatedAt": "2026-08-29T12:00:00Z"
  }
]
```

Estados de consumo:

- `UNCONFIGURED`: no hay producto asociado.
- `GOOD`: todo bien.
- `SOON`: próximo.
- `URGENT`: requiere reposición inmediata.
- `DEPLETED`: el alimento ya debería haberse terminado.
- `NEW_BAG_PENDING`: el pedido fue entregado, pero la bolsa nueva todavía no comenzó.

`activeOrder` es otro eje y nunca reemplaza `consumption`. Si no hay pedido activo, vale `null`.

### `POST /me/replenishment-plans`

Request:

```json
{
  "petId": "pet_milo",
  "estimateId": "est_123",
  "productId": "prod_excellent_adult",
  "variantId": "var_excellent_15",
  "bagStartedAt": "2026-08-20T10:00:00-03:00",
  "remainingBucket": "MORE_THAN_HALF",
  "reminderChannels": ["push", "email"],
  "leadDays": 5
}
```

Response `201`: plan completo.

### `PATCH /me/replenishment-plans/:planId`

Actualiza recordatorios o pausa el seguimiento. Response `200`: plan completo.

### `POST /me/replenishment-plans/:planId/recalibrate`

Request:

```json
{
  "remainingBucket": "ABOUT_HALF",
  "observedAt": "2026-08-29T12:00:00-03:00"
}
```

Response `200`: plan recalculado completo.

### `POST /me/replenishment-plans/:planId/change-product`

Request:

```json
{
  "productId": "prod_pro_plan_adult",
  "variantId": "var_pro_plan_15",
  "bagStartedAt": "2026-08-29T12:00:00-03:00",
  "remainingBucket": "ALMOST_FULL"
}
```

Response `200`: plan completo con la nueva variante y estimación.

### `POST /me/replenishment-plans/:planId/start-bag`

Se usa después de que un pedido fue entregado.

Request:

```json
{
  "orderId": "ord_1043",
  "orderLineId": "line_1",
  "startedAt": "2026-08-30T20:00:00-03:00"
}
```

Response `200`:

```json
{
  "plan": {
    "id": "plan_milo_food",
    "consumption": { "status": "GOOD", "newBagPending": false }
  },
  "order": {
    "id": "ord_1043",
    "bagStartPending": false,
    "bagStartedAt": "2026-08-30T20:00:00-03:00"
  }
}
```

La respuesta real debe incluir los recursos completos con los modelos definidos en este documento.

## 8. Carrito técnico y reposición contextual

La palabra “carrito” puede existir en el API, pero Mobile presenta “Tu entrega” o “Revisar entrega”.

Modelo de carrito:

```json
{
  "id": "cart_123",
  "status": "ACTIVE",
  "source": "REPLENISHMENT",
  "items": [
    {
      "id": "item_1",
      "productId": "prod_excellent_adult",
      "variantId": "var_excellent_15",
      "name": "Excellent Adult Medium & Large",
      "presentation": "15 kg",
      "imageUrl": "https://cdn.example.com/products/excellent-15kg.png",
      "quantity": 1,
      "unitPrice": "82400.00",
      "currency": "ARS",
      "purchasable": true,
      "availability": "TOMORROW",
      "context": {
        "role": "MAIN",
        "petId": "pet_milo",
        "planId": "plan_milo_food"
      }
    }
  ],
  "subtotal": "82400.00",
  "currency": "ARS",
  "updatedAt": "2026-08-29T12:00:00Z"
}
```

### `POST /cart`

Request opcional:

```json
{ "source": "STORE" }
```

Response `201`: carrito completo.

### `GET /cart`

Response `200`: carrito activo completo o `null` si no existe.

### `PUT /cart/items/:variantId`

Sirve para agregar y modificar cantidad.

Request:

```json
{
  "quantity": 2,
  "context": {
    "role": "EXTRA",
    "petId": null,
    "planId": null
  }
}
```

Response `200`: carrito completo con precio y disponibilidad revalidados.

### `DELETE /cart/items/:variantId`

Response `200`: carrito completo después de eliminar la línea.

### `POST /cart/merge`

Une el carrito anónimo con la cuenta al iniciar sesión. Response `200`: carrito resultante completo.

### `POST /replenishment-plans/:planId/reorder-cart`

Debe crear o actualizar el carrito con el alimento principal de la mascota.

Request:

```json
{ "quantity": 1 }
```

Response `201`: carrito completo. El ítem principal debe conservar `petId`, `planId` y `role: MAIN`; los snacks u otros consumibles se agregan como `EXTRA`.

Para Mobile no alcanza una URL de checkout web. Necesitamos el `cart` para mostrar producto, cálculo, extras y resumen editable de forma nativa.

## 9. Checkout, entrega y promociones

Modelo canónico de checkout:

```json
{
  "id": "chk_123",
  "status": "OPEN",
  "stage": "REVIEW",
  "expiresAt": "2026-08-29T13:00:00Z",
  "cart": { "id": "cart_123", "items": [] },
  "contact": {
    "name": "Alejandro Sojo",
    "email": "milo@example.com",
    "phone": "+5491112345678"
  },
  "shippingAddress": null,
  "deliveryInstructions": "",
  "shippingOptions": [],
  "selectedShippingOptionId": null,
  "selectedDeliverySlotId": null,
  "coupon": null,
  "selectedPaymentMethod": null,
  "benefits": [],
  "totals": {
    "items": "82400.00",
    "shipping": "0.00",
    "discount": "0.00",
    "total": "82400.00",
    "currency": "ARS"
  },
  "orderId": null,
  "updatedAt": "2026-08-29T12:00:00Z"
}
```

Cada mutación de checkout debe devolver este objeto completo con totales recalculados.

### `POST /checkout/sessions`

Request:

```json
{ "cartId": "cart_123" }
```

Response `201`: checkout completo.

### `GET /checkout/sessions/:sessionId`

Response `200`: checkout completo. Permite retomar un pago o una entrega interrumpida.

### `PATCH /checkout/sessions/:sessionId/contact`

Request:

```json
{
  "contactName": "Alejandro Sojo",
  "contactEmail": "milo@example.com",
  "contactPhone": "+5491112345678"
}
```

Response `200`: checkout completo.

### `PATCH /checkout/sessions/:sessionId/shipping-address`

Request Mobile preferido:

```json
{
  "addressId": "addr_home",
  "deliveryInstructions": "Timbre 4B. Dejar en seguridad si no estoy."
}
```

El backend debe copiar un snapshot de la dirección al checkout. Si la ruta actual exige el objeto `address` completo, debe ampliarse para aceptar `addressId` e `deliveryInstructions` o devolver ambos al resolver la dirección.

Response `200`: checkout completo, incluyendo el snapshot de dirección.

### `GET /checkout/sessions/:sessionId/shipping-options`

Response `200`:

```json
{
  "options": [
    {
      "id": "delivery_standard",
      "name": "Entrega estándar",
      "price": "0.00",
      "currency": "ARS",
      "available": true,
      "slots": [
        {
          "id": "slot_2026_08_30_14_20",
          "date": "2026-08-30",
          "windowStart": "14:00",
          "windowEnd": "20:00",
          "orderBefore": "10:00",
          "available": true
        }
      ]
    }
  ]
}
```

La fecha mostrada en Entrega y Pedidos sale de esta selección, no del banner de Tienda.

### `PATCH /checkout/sessions/:sessionId/shipping-option`

Request:

```json
{
  "shippingOptionId": "delivery_standard",
  "deliverySlotId": "slot_2026_08_30_14_20"
}
```

Response `200`: checkout completo con entrega y total actualizados.

### `POST /checkout/sessions/:sessionId/coupon`

Request:

```json
{ "code": "PATITAS5000" }
```

Response `200`: checkout completo. `coupon`, `benefits` y `totals.discount` deben reflejar el resultado.

Ejemplo de cupón aplicado:

```json
{
  "coupon": {
    "code": "PATITAS5000",
    "label": "Cupón PATITAS5000",
    "discount": "5000.00"
  },
  "benefits": [
    { "type": "COUPON", "label": "Ahorraste $5.000", "amount": "5000.00" }
  ]
}
```

Cupón inválido: error `422 COUPON_INVALID`. Error técnico: `503` o `500`; la app muestra un estado distinto.

### `DELETE /checkout/sessions/:sessionId/coupon`

Response `200`: checkout completo sin cupón y con totales recalculados.

## 10. Métodos de pago y confirmación

### `GET /payments/methods?checkoutSessionId=chk_123`

Response `200`:

```json
{
  "items": [
    {
      "id": "saved_visa_4242",
      "type": "SAVED_CARD",
      "provider": "PAYWAY",
      "label": "Visa •••• 4242",
      "description": "Predeterminada",
      "enabled": true,
      "savedPaymentMethodId": "pm_123",
      "benefit": null
    },
    {
      "id": "mercado_pago",
      "type": "WALLET",
      "provider": "MERCADO_PAGO",
      "label": "Mercado Pago",
      "description": "Pagá desde Mercado Pago",
      "enabled": true,
      "savedPaymentMethodId": null,
      "benefit": null
    },
    {
      "id": "bank_transfer",
      "type": "BANK_TRANSFER",
      "provider": "BANK_TRANSFER",
      "label": "Transferencia bancaria",
      "description": "El total se actualiza al seleccionarla",
      "enabled": true,
      "savedPaymentMethodId": null,
      "benefit": {
        "type": "PERCENTAGE_DISCOUNT",
        "label": "3% OFF",
        "percentage": "3.00"
      }
    }
  ]
}
```

El backend actual enumera proveedores, pero la UI necesita que esta respuesta indique métodos habilitados, instrumentos guardados y beneficios aplicables al checkout.

### `GET /me/payment-methods`

Ruta nueva si los instrumentos guardados no se incluyen en `/payments/methods`.

Response `200`:

```json
[
  {
    "id": "pm_123",
    "provider": "PAYWAY",
    "type": "CARD",
    "brand": "VISA",
    "lastFour": "4242",
    "expirationMonth": 8,
    "expirationYear": 2029,
    "isDefault": true
  }
]
```

Nunca se devuelven PAN completo, CVV ni credenciales del proveedor.

### `PATCH /checkout/sessions/:sessionId/payment-method`

Request:

```json
{
  "paymentMethod": "BANK_TRANSFER",
  "savedPaymentMethodId": null
}
```

Response `200`: checkout completo con el descuento y total recalculados. Elegir método y confirmar son dos llamadas separadas.

### `POST /checkout/sessions/:sessionId/confirm`

Headers:

```text
Idempotency-Key: 73f41e79-...
```

Request normal después de seleccionar el método:

```json
{}
```

Si un proveedor nativo requiere tokenización:

```json
{
  "payment": {
    "token": "provider-token",
    "paymentMethodId": "visa",
    "bin": "450995",
    "installments": 1
  }
}
```

No enviar `paymentMethod` otra vez en `confirm`; ya fue persistido mediante el `PATCH` anterior.

Response `200/201`:

```json
{
  "order": {
    "id": "ord_1044",
    "number": "1044"
  },
  "payment": {
    "status": "PENDING",
    "provider": "MERCADO_PAGO",
    "paymentUrl": "https://provider.example.com/checkout/..."
  },
  "checkout": {
    "id": "chk_123",
    "status": "CONFIRMED",
    "orderId": "ord_1044"
  }
}
```

Si el pago queda aprobado en la misma llamada, `payment.status` vale `APPROVED` y `paymentUrl` es `null`. Mobile muestra la animación de check y luego la pantalla final con “Ir al inicio” y “Ver mis pedidos”.

### `GET /payments/orders/:orderId/status`

Response `200`:

```json
{
  "orderId": "ord_1044",
  "payment": {
    "status": "APPROVED",
    "provider": "MERCADO_PAGO",
    "approvedAt": "2026-08-29T12:05:00Z",
    "failureCode": null,
    "failureMessage": null
  },
  "orderStatus": "CONFIRMED"
}
```

Estados mínimos de pago: `PENDING | APPROVED | REJECTED | CANCELLED | REFUNDED`.

La vuelta del navegador ayuda a retomar la UI, pero el webhook del proveedor y este estado del backend son la fuente de verdad del pago.

## 11. Pedidos y seguimiento

Modelo de pedido:

```json
{
  "id": "ord_1044",
  "number": "1044",
  "source": "REPLENISHMENT",
  "createdAt": "2026-08-29T12:05:00Z",
  "status": "CONFIRMED",
  "statusLabel": "Pedido confirmado",
  "pet": {
    "id": "pet_milo",
    "name": "Milo"
  },
  "planId": "plan_milo_food",
  "lines": [
    {
      "id": "line_1",
      "productId": "prod_excellent_adult",
      "variantId": "var_excellent_15",
      "name": "Excellent Adult Medium & Large",
      "presentation": "15 kg",
      "imageUrl": "https://cdn.example.com/products/excellent-15kg.png",
      "quantity": 1,
      "unitPrice": "82400.00",
      "lineTotal": "82400.00",
      "currency": "ARS",
      "role": "MAIN",
      "petId": "pet_milo",
      "planId": "plan_milo_food"
    }
  ],
  "fulfillment": {
    "status": "CONFIRMED",
    "estimatedDelivery": {
      "date": "2026-08-30",
      "windowStart": "14:00",
      "windowEnd": "20:00"
    },
    "timeline": [
      {
        "status": "CONFIRMED",
        "state": "COMPLETED",
        "occurredAt": "2026-08-29T12:05:00Z"
      },
      { "status": "PROCESSING", "state": "FUTURE", "occurredAt": null },
      { "status": "SHIPPED", "state": "FUTURE", "occurredAt": null },
      { "status": "DELIVERED", "state": "FUTURE", "occurredAt": null }
    ]
  },
  "shippingAddress": {
    "label": "Casa",
    "formatted": "Av. Corrientes 5200, 4B, CABA"
  },
  "deliveryInstructions": "Timbre 4B.",
  "payment": {
    "status": "APPROVED",
    "methodLabel": "Mercado Pago"
  },
  "benefits": [],
  "totals": {
    "items": "82400.00",
    "shipping": "0.00",
    "discount": "0.00",
    "total": "82400.00",
    "currency": "ARS"
  },
  "bagStartPending": false,
  "bagStartedAt": null
}
```

Estados mínimos de fulfillment:

- `CONFIRMED`
- `PROCESSING`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`

Estados de timeline:

- `COMPLETED`: check.
- `CURRENT`: punto sólido.
- `FUTURE`: paso no interactivo.

### `GET /me/orders?status=active&cursor=...`

Response `200`:

```json
{
  "items": [
    {
      "id": "ord_1044",
      "number": "1044",
      "status": "PROCESSING",
      "statusLabel": "En preparación",
      "createdAt": "2026-08-29T12:05:00Z",
      "estimatedDelivery": {
        "date": "2026-08-30",
        "windowStart": "14:00",
        "windowEnd": "20:00"
      },
      "productSummary": "Excellent Adult Medium & Large + 2 productos",
      "total": "97800.00",
      "currency": "ARS",
      "pet": { "id": "pet_milo", "name": "Milo" }
    }
  ],
  "nextCursor": null
}
```

Filtros previstos: `active | delivered | cancelled | all`. Sin pedidos devuelve `items: []`, no error.

### `GET /me/orders/:orderId`

Response `200`: pedido completo según el modelo canónico anterior. Este endpoint alimenta la timeline, entrega estimada, productos, dirección, pago y totales.

### `GET /me/orders/pets/:petId/purchase-history`

Response `200`:

```json
{
  "items": [
    {
      "orderId": "ord_1038",
      "orderNumber": "1038",
      "orderedAt": "2026-08-01T12:00:00Z",
      "deliveredAt": "2026-08-02T18:40:00Z",
      "productId": "prod_excellent_adult",
      "variantId": "var_excellent_15",
      "name": "Excellent Adult Medium & Large",
      "presentation": "15 kg",
      "quantity": 1,
      "unitPrice": "82400.00",
      "currency": "ARS",
      "bagStartedAt": "2026-08-03T09:00:00Z"
    }
  ],
  "averageConsumptionDays": 40,
  "nextCursor": null
}
```

“Compraste antes” puede usar este historial o `GET /products?previouslyPurchased=true`.

## 12. Notificaciones

En producción no alcanza con programar una notificación local. El backend debe emitir eventos cuando cambia un pedido, se acerca la reposición o queda una bolsa nueva pendiente.

### `GET /communications/notification-preferences`

Response `200`:

```json
{
  "push": true,
  "email": true,
  "whatsapp": false,
  "orderUpdates": true,
  "replenishmentReminders": true
}
```

La pantalla posterior al pago no vuelve a pedir activar avisos si `push` ya está activo y el dispositivo tiene permiso.

### `PATCH /communications/notification-preferences`

Request completo o parcial, según defina backend:

```json
{
  "push": true,
  "email": true,
  "whatsapp": false,
  "orderUpdates": true,
  "replenishmentReminders": true
}
```

Response `200`: preferencias completas actualizadas.

### `POST /communications/device-tokens`

Request:

```json
{
  "token": "ExponentPushToken[...]",
  "platform": "ios",
  "provider": "EXPO",
  "appVersion": "1.0.0",
  "deviceId": "installation-uuid"
}
```

Response `201`:

```json
{
  "id": "device_token_123",
  "platform": "ios",
  "provider": "EXPO",
  "createdAt": "2026-08-29T12:00:00Z",
  "lastSeenAt": "2026-08-29T12:00:00Z"
}
```

El endpoint debe ser idempotente para el mismo usuario, dispositivo y token.

### `DELETE /communications/device-tokens/:deviceTokenId`

Response `204`. Se llama al cerrar sesión o cuando el token deja de ser válido.

### `GET /me/notifications?unreadOnly=false&cursor=...`

Response `200`:

```json
{
  "items": [
    {
      "id": "ntf_123",
      "type": "ORDER_STATUS_CHANGED",
      "title": "Tu pedido está en camino",
      "body": "Llega hoy entre las 14:00 y las 20:00.",
      "createdAt": "2026-08-30T09:00:00Z",
      "readAt": null,
      "target": {
        "type": "order",
        "id": "ord_1044"
      }
    }
  ],
  "unreadCount": 1,
  "nextCursor": null
}
```

Tipos mínimos:

- `ORDER_CONFIRMED`
- `ORDER_STATUS_CHANGED`
- `ORDER_DELIVERED`
- `REPLENISHMENT_SOON`
- `REPLENISHMENT_URGENT`
- `NEW_BAG_PENDING`

### `PATCH /me/notifications/:notificationId/read`

Response `200`: notificación completa con `readAt`.

### `POST /me/notifications/read-all`

Response `200`:

```json
{ "updated": 5, "unreadCount": 0 }
```

## 13. Qué consume cada pantalla

| Pantalla             | Endpoints                                                                     |
| -------------------- | ----------------------------------------------------------------------------- |
| Inicio               | `GET /me/pets`, `GET /me/replenishment-plans`, `GET /me/orders?status=active` |
| Mascotas             | `GET /me/pets`, `GET /me/replenishment-plans`                                 |
| Sumar/editar mascota | `GET /pet-breeds`, `POST/PATCH /me/pets`                                      |
| Detalle de mascota   | mascotas + planes + `GET /me/orders/pets/:petId/purchase-history`             |
| Ajustar cuánto queda | `POST /me/replenishment-plans/:id/recalibrate`                                |
| Iniciar bolsa        | `POST /me/replenishment-plans/:id/start-bag`                                  |
| Tienda               | categorías + productos + ofertas + carrito                                    |
| Producto             | `GET /products/:slug`, carrito                                                |
| Reponer              | plan + estimate + reorder-cart + productos extras                             |
| Resumen de entrega   | carrito + checkout + cupón                                                    |
| Entrega              | direcciones + shipping address + shipping options                             |
| Pago                 | payment methods + select payment + confirm                                    |
| Confirmación         | respuesta de confirm + estado de pago + preferencias de avisos                |
| Pedidos              | `GET /me/orders`                                                              |
| Detalle de pedido    | `GET /me/orders/:id`, estado de pago                                          |
| Avisos               | preferencias + device token + bandeja de notificaciones                       |
| Cuenta               | customer + direcciones + preferencias                                         |

Inicio no necesita un endpoint agregado propio en V1. Puede componer estas tres respuestas y aplicar localmente la prioridad:

`DEPLETED → URGENT → acción pendiente → SOON → GOOD`.

La “acción pendiente” se detecta con `NEW_BAG_PENDING` o un pedido/logística que requiere atención, pero nunca se convierte en estado de consumo.

## 14. Orden recomendado de implementación

### P0 — desbloquea el frontend real

1. Extender mascota con sexo, edad, raza y avatar.
2. Completar catálogo con imágenes, precio por variante y fulfillment comprable hoy/mañana.
3. Completar planes con estado de consumo separado de pedido.
4. Devolver carrito nativo desde reposición y conservar el contexto mascota/plan.
5. Cerrar checkout editable: dirección, instrucciones, slot, cupón, método y totales.
6. Confirmar el pedido con idempotencia y resolver pago pendiente/aprobado.
7. Completar pedido con múltiples líneas, timeline y entrega estimada.
8. Registrar token push y emitir cambios de pedido/reposición.

### P1 — completa comodidad y retención

1. Catálogo de razas comunes.
2. Instrumentos de pago guardados.
3. Bandeja de notificaciones y estado leído.
4. Baja de device token.

## 15. Decisiones de backend que deben quedar cerradas

Antes de conectar producción hay que definir explícitamente:

- proveedor y tokenización de tarjetas guardadas;
- implementación real de transferencia y regla del 3%;
- origen de stock `IN_STOCK` frente a proveedor `ON_REQUEST`;
- cálculo de corte y promesa de entrega por código postal;
- política de primera compra y envío gratis;
- eventos que disparan push, email y WhatsApp;
- fuente autoritativa del estado `NEW_BAG_PENDING`;
- almacenamiento de fotos de mascotas y productos.

Estas decisiones no cambian la navegación ya diseñada, pero sí determinan qué campos pueden considerarse definitivos y qué estados puede confirmar el backend.
