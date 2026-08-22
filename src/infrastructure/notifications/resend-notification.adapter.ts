import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createElement, type ReactElement } from 'react';
import { Resend } from 'resend';
import type {
  NotificationInput,
  NotificationProvider,
  NotificationResult,
} from '../../shared/application/ports/notification-provider.interface';
import {
  AbandonedCartEmail,
  type AbandonedCartEmailProps,
} from './email-templates/abandoned-cart.email';
import {
  ReplenishmentReminderEmail,
  type ReplenishmentReminderEmailProps,
} from './email-templates/replenishment-reminder.email';

interface RenderedEmail {
  subject: string;
  element: ReactElement;
}

type TemplateRenderer = (
  variables: Record<string, string>,
  appUrl: string,
) => RenderedEmail;

const templateRenderers: Readonly<Record<string, TemplateRenderer>> = {
  abandoned_cart: (variables, appUrl) => {
    const props: AbandonedCartEmailProps = {
      cartId: requiredVariable(variables, 'cartId'),
      appUrl,
    };
    return {
      subject: 'Tu carrito sigue esperándote | Patitas Inquietas',
      element: createElement(AbandonedCartEmail, props),
    };
  },
  replenishment_reminder: (variables, appUrl) => {
    const props: ReplenishmentReminderEmailProps = {
      petName: requiredVariable(variables, 'petName'),
      planId: requiredVariable(variables, 'planId'),
      appUrl,
    };
    return {
      subject: 'Recordatorio de recompra | Patitas Inquietas',
      element: createElement(ReplenishmentReminderEmail, props),
    };
  },
};

@Injectable()
export class ResendNotificationAdapter implements NotificationProvider {
  private readonly client: Resend | undefined;
  private readonly apiKey: string | undefined;
  private readonly from: string | undefined;
  private readonly replyTo: string | undefined;
  private readonly appUrl: string | undefined;

  public constructor(config: ConfigService) {
    this.apiKey = readOptional(config, 'RESEND_API_KEY');
    this.from = readOptional(config, 'RESEND_FROM_EMAIL');
    this.replyTo = readOptional(config, 'RESEND_REPLY_TO');
    this.appUrl = readOptional(config, 'RESEND_APP_URL');
    this.client = this.apiKey ? new Resend(this.apiKey) : undefined;
  }

  public async send(input: NotificationInput): Promise<NotificationResult> {
    if (input.channel !== 'EMAIL') {
      throw new Error(
        'Resend sólo puede enviar notificaciones con canal EMAIL.',
      );
    }

    const apiKey = this.apiKey;
    const from = this.from;
    const appUrl = this.appUrl;
    const client = this.client;
    if (!apiKey || !from || !appUrl || !client) {
      throw new Error(
        'RESEND_API_KEY, RESEND_FROM_EMAIL y RESEND_APP_URL son obligatorias para Resend.',
      );
    }

    const renderer = templateRenderers[input.template];
    if (!renderer) {
      throw new Error(`Plantilla de email no soportada: ${input.template}.`);
    }

    const rendered = renderer(input.variables, normalizeAppUrl(appUrl));
    const result = await client.emails.send({
      from,
      to: [input.destination.trim()],
      subject: rendered.subject,
      react: rendered.element,
      ...(this.replyTo ? { replyTo: this.replyTo } : {}),
      ...(input.idempotencyKey
        ? { headers: { 'Idempotency-Key': input.idempotencyKey } }
        : {}),
    });

    if (result.error) throw new Error('Resend rechazó el email.');

    return result.data?.id ? { providerMessageId: result.data.id } : {};
  }
}

const requiredVariable = (
  variables: Record<string, string>,
  key: string,
): string => {
  const value = variables[key]?.trim();
  if (!value) throw new Error(`Falta la variable ${key} para el email.`);
  return value;
};

const readOptional = (config: ConfigService, key: string): string | undefined =>
  config.get<string>(key)?.trim() || undefined;

const normalizeAppUrl = (value: string): string => {
  const url = new URL(value);
  return url.toString().replace(/\/$/, '');
};
