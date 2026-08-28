export type ApplicationEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  NODE_ENV: ApplicationEnvironment;
  PORT: number;
  CORS_ORIGINS: string;
  PAYMENT_PROVIDER: 'simulated' | 'mercadopago';
  MERCADOPAGO_ACCESS_TOKEN?: string;
  MERCADOPAGO_WEBHOOK_SECRET?: string;
  MERCADOPAGO_NOTIFICATION_URL?: string;
  PUBLIC_WEB_URL?: string;
}

const requireValue = (
  environment: Record<string, unknown>,
  key: keyof EnvironmentVariables,
): string => {
  const value = environment[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`La variable ${key} es obligatoria.`);
  }
  return value.trim();
};

const validateUrl = (
  value: string,
  key: keyof EnvironmentVariables,
  protocols: string[],
): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`La variable ${key} debe ser una URL válida.`);
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(
      `La variable ${key} debe usar uno de estos protocolos: ${protocols.join(', ')}.`,
    );
  }
  return value;
};

export const validateEnvironment = (
  environment: Record<string, unknown>,
): EnvironmentVariables => {
  const rawNodeEnv = environment['NODE_ENV'];
  const nodeEnv = typeof rawNodeEnv === 'string' ? rawNodeEnv : 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV debe ser development, test o production.');
  }

  const port = Number(environment['PORT'] ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un puerto TCP válido.');
  }

  const rawCorsOrigins = environment['CORS_ORIGINS'];
  const corsOrigins =
    typeof rawCorsOrigins === 'string' && rawCorsOrigins.trim()
      ? rawCorsOrigins.trim()
      : 'http://localhost:3000';
  const rawPaymentProvider = environment['PAYMENT_PROVIDER'];
  const paymentProvider =
    typeof rawPaymentProvider === 'string'
      ? rawPaymentProvider.trim().toLowerCase()
      : 'simulated';
  if (!['simulated', 'mercadopago'].includes(paymentProvider)) {
    throw new Error('PAYMENT_PROVIDER debe ser simulated o mercadopago.');
  }
  if (nodeEnv === 'production' && paymentProvider !== 'mercadopago')
    throw new Error(
      'En producción PAYMENT_PROVIDER debe ser mercadopago; el proveedor simulado solo está permitido fuera de producción.',
    );
  const mercadoPagoAccessToken = optionalValue(
    environment['MERCADOPAGO_ACCESS_TOKEN'],
  );
  const mercadoPagoWebhookSecret = optionalValue(
    environment['MERCADOPAGO_WEBHOOK_SECRET'],
  );
  const mercadoPagoNotificationUrl = optionalValue(
    environment['MERCADOPAGO_NOTIFICATION_URL'],
  );
  const publicWebUrl = optionalValue(environment['PUBLIC_WEB_URL']);
  if (publicWebUrl)
    validateUrl(publicWebUrl, 'PUBLIC_WEB_URL', ['http:', 'https:']);
  if (paymentProvider === 'mercadopago') {
    if (!mercadoPagoAccessToken)
      throw new Error(
        'MERCADOPAGO_ACCESS_TOKEN es obligatoria cuando PAYMENT_PROVIDER=mercadopago.',
      );
    if (!mercadoPagoWebhookSecret)
      throw new Error(
        'MERCADOPAGO_WEBHOOK_SECRET es obligatoria cuando PAYMENT_PROVIDER=mercadopago.',
      );
  }
  if (mercadoPagoNotificationUrl)
    validateUrl(mercadoPagoNotificationUrl, 'MERCADOPAGO_NOTIFICATION_URL', [
      'http:',
      'https:',
    ]);

  return {
    DATABASE_URL: validateUrl(
      requireValue(environment, 'DATABASE_URL'),
      'DATABASE_URL',
      ['postgres:', 'postgresql:'],
    ),
    SUPABASE_URL: validateUrl(
      requireValue(environment, 'SUPABASE_URL'),
      'SUPABASE_URL',
      ['http:', 'https:'],
    ),
    SUPABASE_PUBLISHABLE_KEY: requireValue(
      environment,
      'SUPABASE_PUBLISHABLE_KEY',
    ),
    SUPABASE_SECRET_KEY: requireValue(environment, 'SUPABASE_SECRET_KEY'),
    NODE_ENV: nodeEnv as ApplicationEnvironment,
    PORT: port,
    CORS_ORIGINS: corsOrigins,
    PAYMENT_PROVIDER: paymentProvider as 'simulated' | 'mercadopago',
    ...(mercadoPagoAccessToken
      ? { MERCADOPAGO_ACCESS_TOKEN: mercadoPagoAccessToken }
      : {}),
    ...(mercadoPagoWebhookSecret
      ? { MERCADOPAGO_WEBHOOK_SECRET: mercadoPagoWebhookSecret }
      : {}),
    ...(mercadoPagoNotificationUrl
      ? { MERCADOPAGO_NOTIFICATION_URL: mercadoPagoNotificationUrl }
      : {}),
    ...(publicWebUrl ? { PUBLIC_WEB_URL: publicWebUrl } : {}),
  };
};

const optionalValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
