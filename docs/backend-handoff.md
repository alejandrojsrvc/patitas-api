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

- `GET /api/v1/shipping/quote` devuelve cobertura, costo y plazo real según
  código postal/barrio, subtotal y peso.
- Admin configura zonas en `/api/v1/admin/shipping-options/zones`.
- `/api/v1/replenishment-plans` permite crear, consultar, pausar, reactivar,
  cancelar y generar un carrito de recompra.
- Una recompra solo crea un carrito; nunca realiza un cobro automático.

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

Mercado Pago se habilita con `PAYMENT_PROVIDER=mercadopago`,
`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` y opcionalmente
`MERCADOPAGO_NOTIFICATION_URL`. Sin esa configuración se usa el proveedor
simulado.
