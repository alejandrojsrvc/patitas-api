# Backend handoff operativo

La API mantiene las superficies Public, Customer y Admin bajo `/api/v1`.
Swagger se publica en `/api/v1/docs` y el JSON en `/api/v1/docs-json` fuera de
producción.

## Checkout y pagos

- `POST /api/v1/checkout/sessions/:id/confirm` recalcula precio, descuentos,
  envío y stock en servidor.
- `SIMULATED_*` crea un pedido de demostración pagado.
- `MERCADO_PAGO` crea un pedido `PENDING_PAYMENT`, reserva stock y devuelve un
  enlace de pago. El navegador nunca confirma el pago.
- `POST /api/v1/payments/orders/:id/link` permite reintentar un enlace pendiente.
- `POST /api/v1/payments/webhooks/mercadopago` procesa eventos firmados e
  idempotentes.

No se almacenan tarjetas. El frontend debe conservar el `publicToken` del
checkout invitado y redirigir a `payment.paymentUrl`; después debe consultar el
pedido o esperar la actualización del webhook.

## Catálogo, envío y recompra

- `GET /api/v1/shipping/quote` devuelve disponibilidad, costo final y plazo
  según localidad, subtotal y peso. La respuesta pública no expone el costo
  logístico ni el subsidio.
- `GET /api/v1/checkout/sessions/:id/shipping-options` devuelve las opciones
  disponibles para la sesión con `id`, `name` y `cost` final para el cliente.
- Admin configura opciones en `/api/v1/admin/shipping-options` y zonas en
  `/api/v1/admin/shipping-options/zones`.
- `GET /api/v1/admin/shipping-options/quote` devuelve el desglose interno de
  tarifa, IVA, subsidio, cantidad de entregas, cobertura y cortes de colecta.
- El cálculo usa una entrega hasta 20 kg, dos entregas entre más de 20 kg y 30
  kg, IVA del 21% y el subsidio de la regla de pricing activa. Más de 30 kg no
  está disponible.
- `/api/v1/replenishment-plans` permite crear, consultar, pausar, reactivar,
  cancelar y generar un carrito de recompra.
- Una recompra solo crea un carrito; nunca realiza un cobro automático.

`POST /api/v1/admin/products/import-csv` acepta un CSV de catálogo con las
columnas de producto y, opcionalmente, `supplier`, `supplier_product_name` y
`cost_price`. Cuando esas columnas vienen informadas, la misma importación
crea o actualiza la oferta del proveedor de forma idempotente. El proveedor se
crea automáticamente si todavía no existe.

El frontend debe enviar un solo archivo con `publish=true`. La importación
puede crear el producto aunque la publicación falle; el resultado devuelve
`publishError` por producto y `supplierOffers` con el resumen de ofertas.

Un producto puede publicarse sin una oferta de proveedor. Para publicarlo se
requieren marca y categoría activas, una imagen y al menos una variante activa
con SKU y precio de venta. El inventario y el proveedor determinan si la
variante aparece disponible para comprar, pero no bloquean la publicación.

## Proveedores

`POST /api/v1/admin/supplier-offers/import-csv` importa ofertas de proveedores
mediante `multipart/form-data`. Requiere un usuario Admin, el archivo en el
campo `file` y acepta opcionalmente `dryRun=true` para validar y previsualizar
sin escribir.

`GET /api/v1/admin/supplier-offers/import-template` descarga una plantilla CSV
con las columnas y una fila de ejemplo editable.

El CSV usa una fila por oferta. El proveedor se identifica con `supplier_id` o
`supplier_name`; la variante con `variant_id`, `sku` o `barcode`/`ean`.

```csv
supplier_id,sku,supplier_sku,unit_cost,stock_status,lead_time_hours,minimum_quantity,active
<supplier-uuid>,OLD-PRINCE-ADULTO-20KG,PROV-001,12500.00,AVAILABLE,48,1,true
```

La combinación proveedor + variante es idempotente: si no existe crea la
oferta y si existe actualiza sus datos e incrementa su revisión. Si alguna fila
es inválida, no se escribe ninguna fila y la respuesta incluye `errors`.

## Consentimiento y jobs

El consentimiento se registra en `POST /api/v1/communications/consents` con
canal, destino y versión. `POST /api/v1/communications/unsubscribe` pausa los
planes de ese canal. Jobs externos protegidos por `X-Cron-Secret` invocan:

```text
POST /api/v1/internal/jobs/abandoned-carts
POST /api/v1/internal/jobs/replenishment-reminders
```

El proveedor de mensajes por defecto es `noop`. Para un proveedor HTTP:
`NOTIFICATION_PROVIDER=http`, `NOTIFICATION_PROVIDER_URL` y
`NOTIFICATION_PROVIDER_TOKEN`.

## Marketing, combos y referidos

`POST /api/v1/marketing/events` recibe `Quiz_Completed`, `InitiateCheckout` y
`Purchase`. La clave `eventName + eventId` deduplica el evento; el frontend
debe usar el mismo `eventId` en Pixel y Conversions API.

Las promociones pueden ser `DISCOUNT` o `BUNDLE`; el backend devuelve el
descuento aplicable. Los referidos autenticados usan `/api/v1/me/referrals` y
los códigos se relacionan con un ledger preparado para créditos, débitos y
reversiones.

## Configuración y persistencia

La migración `20260822050000_handoff_operations` es la fuente de verdad para
estas tablas: planes, intentos/webhooks de pago, zonas, consentimientos,
notificaciones, marketing, combos y referidos. Debe aplicarse con el flujo
normal de migraciones del proyecto; no se ejecutó desde este handoff.

Los proveedores habilitados se declaran separados por coma, por ejemplo
`PAYMENT_PROVIDERS=mercadopago,payway`. Mercado Pago usa
`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`,
`MERCADOPAGO_WEBHOOK_SECRET` y opcionalmente
`MERCADOPAGO_NOTIFICATION_URL`. Payway API Payments usa `PAYWAY_SITE_ID`,
`PAYWAY_PUBLIC_API_KEY`, `PAYWAY_PRIVATE_API_KEY`, `PAYWAY_API_BASE_URL` y
`PAYWAY_WEBHOOK_SECRET`, además de opcionalmente `PAYWAY_NOTIFICATION_URL`. La URL de notificación Payway debe
configurarse también en el portal como
`/api/v1/payments/webhooks/payway`. La public key y el Site ID se entregan al
frontend por su configuración de despliegue; la private key permanece en la
API. El proveedor simulado solo está permitido fuera de producción.

Para sandbox de Mercado Pago se debe usar la `Public Key` y el access token
`TEST-...` de una cuenta de prueba propia y habilitarlo explícitamente con
`PAYMENT_PROVIDERS=mercadopago,simulated`. No existe una credencial sandbox
universal que pueda incluirse en el repositorio.

El frontend tokeniza la tarjeta directamente con el SDK de Payway y envía
`token`, `paymentMethodId`, `bin` e `installments` al confirmar el checkout. La
API no persiste el token. Un intento rechazado devuelve `action=RETRY`; Mercado
Pago devuelve `action=REDIRECT` y `paymentUrl`.

Las operaciones de inicio de pago requieren `Idempotency-Key`. El estado
normalizado se puede recuperar con `GET /api/v1/payments/orders/:id/status` y
devuelve `paymentStatus`, `canRetry` y `reconciliationRequired`. Los refunds
administrativos usan `POST /api/v1/payments/orders/:id/refund`, requieren rol
`ADMIN`, `Idempotency-Key` y un monto opcional.

## Análisis de pricing y punto de equilibrio

`GET /api/v1/admin/pricing/scenarios/:id/analysis` conserva los totales
existentes y ahora devuelve también `catalogCoverage` y `costBreakdown`.

Para generar revisiones de precio para todo el catálogo usando un escenario:

```http
POST /api/v1/admin/pricing/recalculate
Authorization: Bearer <admin-token>
Content-Type: application/json
```

```json
{
  "scenarioId": "b4961aa1-409b-4559-9ad0-4c5afdefe1f8"
}
```

La operación considera variantes activas con al menos una oferta activa y usa
la oferta activa de menor costo unitario. Crea revisiones `PENDING`, reemplaza
las revisiones pendientes anteriores de cada variante y no modifica todavía el
precio de venta. Devuelve el total procesado y los datos necesarios para
aplicar cada revisión:

```json
{
  "scenarioId": "b4961aa1-409b-4559-9ad0-4c5afdefe1f8",
  "processed": 42,
  "reviews": [
    {
      "variantId": "...",
      "pricingReviewId": "...",
      "recommendedPrice": "20000.00",
      "commercialPrice": "20990.00"
    }
  ]
}
```

El backoffice puede aplicar cada elemento con
`POST /api/v1/admin/variants/:variantId/apply-price`, enviando su
`pricingReviewId`. También puede consultar las revisiones con
`GET /api/v1/admin/pricing/reviews?status=PENDING`. Las revisiones quedan
obsoletas si cambia la variante, la oferta, la configuración activa o la oferta
preferida.

`catalogCoverage` informa:

- `variantsConsidered`: variantes activas con precio de venta.
- `variantsIncluded`: variantes que además tienen una oferta activa.
- `variantsWithoutActiveOffer`: variantes excluidas por no tener oferta activa.
- `includedVariants`: producto, SKU, precio, proveedor y costo unitario usados.
- `supplierOfferSelection`: siempre `LOWEST_ACTIVE_UNIT_COST`.
- `inventoryUsed`: `false`; el stock se muestra como referencia, pero no altera
  el cálculo.
- `productStatusFilterApplied`: `false`; el análisis trabaja sobre variantes
  activas, no sobre el estado editorial del producto.

`costBreakdown` contiene las líneas de costos fijos mensuales, por pedido, por
unidad y porcentuales, junto con los totales de cada grupo. También devuelve
los valores de las reglas de pricing, la comisión efectiva de la pasarela
seleccionada (`paymentFeePercent` más su IVA cuando `paymentFeeVatApplies` es
`true`), el porcentaje total aplicado sobre la venta y los promedios usados
para llegar al costo variable y al aporte por pedido.

Las tarifas de pago se administran con:

- `GET /api/v1/admin/pricing/payment-fees`
- `POST /api/v1/admin/pricing/payment-fees`
- `PATCH /api/v1/admin/pricing/payment-fees/:id`
- `POST /api/v1/admin/pricing/payment-fees/:id/select`

Una tarifa identifica la pasarela (`MERCADOPAGO` o `PAYWAY`), el producto
(`CHECKOUT_PRO`), los días de acreditación, la comisión, el costo fijo y si
aplica IVA (`vatApplies` y `vatPercent`). La selección global copia esos
valores al borrador de reglas y requiere activar la nueva versión.

Cada escenario puede tener su propia `paymentFeeScheduleId`. Si queda vacío,
el análisis usa la regla global activa. Esto permite comparar escenarios con
Mercado Pago y Payway, o diferentes plazos de acreditación, sin modificar la
regla global. El análisis devuelve la tarifa utilizada en
`paymentFeeSchedule`. La migración
`20260826010000_multi_gateway_pricing` agrega estos campos y el valor
`PAYWAY`; debe aplicarse con el flujo normal de migraciones antes de usar
esta funcionalidad.

El frontend debe mostrar una sección “Cómo se calculó” usando esos datos, sin
duplicar las fórmulas. La facturación de equilibrio es facturación bruta y se
calcula como:

```text
pedidos de equilibrio × precio medio por unidad × productos medios por pedido
```

Los pedidos de equilibrio se calculan como `ceil(costos fijos mensuales /
aporte por pedido)`. El resultado no usa inventario ni mix histórico de
productos; solo puede usar la cantidad de pedidos del período anterior cuando
el escenario tiene `ordersSource=PREVIOUS_PERIOD`.
