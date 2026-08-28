export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');

export interface NotificationInput {
  channel: 'EMAIL' | 'WHATSAPP' | 'PUSH';
  destination: string;
  template: string;
  variables: Record<string, string>;
  idempotencyKey?: string;
}

export interface NotificationResult {
  providerMessageId?: string;
}

export interface NotificationProvider {
  send(input: NotificationInput): Promise<NotificationResult>;
}
