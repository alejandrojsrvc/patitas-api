import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { renderToStaticMarkup } from 'react-dom/server';
import nodemailer, { type Transporter } from 'nodemailer';
import type { NotificationInput, NotificationProvider, NotificationResult } from '../../shared/application/ports/notification-provider.interface';
import { renderNotificationEmail } from './email-renderer';

@Injectable()
export class SmtpNotificationAdapter implements NotificationProvider {
  private readonly transporter: Transporter | undefined;
  private readonly from: string | undefined;
  private readonly replyTo: string | undefined;
  private readonly appUrl: string | undefined;

  public constructor(config: ConfigService) {
    const host = optional(config, 'SMTP_HOST');
    const port = Number(config.get<string>('SMTP_PORT', '1025'));
    this.from = optional(config, 'SMTP_FROM_EMAIL');
    this.replyTo = optional(config, 'SMTP_REPLY_TO');
    this.appUrl = optional(config, 'SMTP_APP_URL');
    this.transporter =
      host && Number.isInteger(port) && port >= 1 && port <= 65535 ? nodemailer.createTransport({ host, port, secure: false }) : undefined;
  }

  public async send(input: NotificationInput): Promise<NotificationResult> {
    if (input.channel !== 'EMAIL') throw new Error('SMTP sólo puede enviar notificaciones con canal EMAIL.');
    if (!this.transporter || !this.from || !this.appUrl)
      throw new Error('SMTP_HOST, SMTP_PORT, SMTP_FROM_EMAIL y SMTP_APP_URL son obligatorias para SMTP.');
    const rendered = renderNotificationEmail(input.template, input.variables, this.appUrl);
    const result = await this.transporter.sendMail({
      from: this.from,
      to: input.destination.trim(),
      subject: rendered.subject,
      html: `<!doctype html>${renderToStaticMarkup(rendered.element)}`,
      ...(this.replyTo ? { replyTo: this.replyTo } : {}),
      ...(input.idempotencyKey ? { headers: { 'X-Idempotency-Key': input.idempotencyKey } } : {}),
    });
    return { providerMessageId: result.messageId };
  }
}

const optional = (config: ConfigService, key: string): string | undefined => config.get<string>(key)?.trim() || undefined;
