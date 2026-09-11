import { createElement, type ReactElement } from 'react';
import { OrderConfirmationEmail, type OrderConfirmationEmailProps } from './email-templates/order-confirmation.email';
import { AdminInvitationEmail, type AdminInvitationEmailProps } from './email-templates/admin-invitation.email';
import { AbandonedCartEmail, type AbandonedCartEmailProps } from './email-templates/abandoned-cart.email';
import { AccountConfirmationEmail, type AccountConfirmationEmailProps } from './email-templates/account-confirmation.email';
import { PasswordRecoveryEmail, type PasswordRecoveryEmailProps } from './email-templates/password-recovery.email';
import { ReplenishmentReminderEmail, type ReplenishmentReminderEmailProps } from './email-templates/replenishment-reminder.email';

export interface RenderedEmail {
  subject: string;
  element: ReactElement;
}

type TemplateRenderer = (variables: Record<string, string>, appUrl: string) => RenderedEmail;

const templateRenderers: Readonly<Record<string, TemplateRenderer>> = {
  order_confirmation: (variables, appUrl) => {
    const status = variables.status === 'pending' ? 'pending' : variables.status === 'failed' ? 'failed' : 'approved';
    return {
      subject:
        status === 'approved'
          ? `Pedido #${requiredVariable(variables, 'orderNumber')} confirmado | Patitas Inquietas`
          : `Actualización del pedido #${requiredVariable(variables, 'orderNumber')} | Patitas Inquietas`,
      element: createElement(OrderConfirmationEmail, {
        customerName: requiredVariable(variables, 'customerName'),
        orderNumber: requiredVariable(variables, 'orderNumber'),
        orderDate: requiredVariable(variables, 'orderDate'),
        paymentStatus: requiredVariable(variables, 'paymentStatus'),
        paymentMethod: requiredVariable(variables, 'paymentMethod'),
        items: parseItems(variables.items),
        subtotal: requiredVariable(variables, 'subtotal'),
        discount: requiredVariable(variables, 'discount'),
        shipping: requiredVariable(variables, 'shipping'),
        total: requiredVariable(variables, 'total'),
        address: requiredVariable(variables, 'address'),
        deliveryEstimate: requiredVariable(variables, 'deliveryEstimate'),
        actionUrl: variables.actionUrl?.trim()
          ? new URL(variables.actionUrl.trim(), `${appUrl}/`).toString()
          : variables.token?.trim()
            ? buildActionUrl(appUrl, '/activar-cuenta', { token: requiredVariable(variables, 'token') })
            : buildActionUrl(appUrl, '/checkout/resultado', { orderId: requiredVariable(variables, 'orderId') }),
        actionLabel: requiredVariable(variables, 'actionLabel'),
        supportUrl: buildActionUrl(appUrl, '/contacto', {}),
        status,
      } satisfies OrderConfirmationEmailProps),
    };
  },
  account_confirmation: (variables, appUrl) => ({
    subject: 'Confirmá tu cuenta | Patitas Inquietas',
    element: createElement(AccountConfirmationEmail, {
      actionUrl: buildActionUrl(appUrl, '/auth/confirm', {
        token: requiredVariable(variables, 'token'),
        type: requiredVariable(variables, 'type'),
      }),
    } satisfies AccountConfirmationEmailProps),
  }),
  password_recovery: (variables, appUrl) => ({
    subject: 'Recuperá tu contraseña | Patitas Inquietas',
    element: createElement(PasswordRecoveryEmail, {
      actionUrl: buildActionUrl(appUrl, '/auth/reset-password', { token: requiredVariable(variables, 'token') }),
    } satisfies PasswordRecoveryEmailProps),
  }),
  admin_invitation: (variables, appUrl) => ({
    subject: 'Invitación administrativa | Patitas Inquietas',
    element: createElement(AdminInvitationEmail, {
      actionUrl: buildActionUrl(appUrl, '/auth/accept-invitation', { token: requiredVariable(variables, 'token') }),
    } satisfies AdminInvitationEmailProps),
  }),
  abandoned_cart: (variables, appUrl) => ({
    subject: 'Tu carrito sigue esperándote | Patitas Inquietas',
    element: createElement(AbandonedCartEmail, {
      cartId: requiredVariable(variables, 'cartId'),
      appUrl,
    } satisfies AbandonedCartEmailProps),
  }),
  replenishment_reminder: (variables, appUrl) => ({
    subject: 'Recordatorio de recompra | Patitas Inquietas',
    element: createElement(ReplenishmentReminderEmail, {
      petName: requiredVariable(variables, 'petName'),
      planId: requiredVariable(variables, 'planId'),
      appUrl,
    } satisfies ReplenishmentReminderEmailProps),
  }),
};

const parseItems = (value: string | undefined): OrderConfirmationEmailProps['items'] => {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is OrderConfirmationEmailProps['items'][number] =>
          Boolean(item && typeof item === 'object' && 'name' in item && 'quantity' in item && 'unitPrice' in item && 'total' in item),
        )
      : [];
  } catch {
    return [];
  }
};

export const renderNotificationEmail = (template: string, variables: Record<string, string>, appUrl: string): RenderedEmail => {
  const renderer = templateRenderers[template];
  if (!renderer) throw new Error(`Plantilla de email no soportada: ${template}.`);
  return renderer(variables, normalizeAppUrl(appUrl));
};

const requiredVariable = (variables: Record<string, string>, key: string): string => {
  const value = variables[key]?.trim();
  if (!value) throw new Error(`Falta la variable ${key} para el email.`);
  return value;
};

const normalizeAppUrl = (value: string): string => new URL(value).toString().replace(/\/$/, '');

const buildActionUrl = (appUrl: string, path: string, query: Record<string, string>): string => {
  const url = new URL(path, `${appUrl}/`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
};
