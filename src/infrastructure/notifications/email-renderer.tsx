import { createElement, type ReactElement } from 'react';
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
