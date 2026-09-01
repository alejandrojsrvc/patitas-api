export type ApplicationEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  NODE_ENV: ApplicationEnvironment;
  PORT: number;
  CORS_ORIGINS: string;
  MERCADOPAGO_ACCESS_TOKEN?: string;
  MERCADOPAGO_PUBLIC_KEY?: string;
  MERCADOPAGO_WEBHOOK_SECRET?: string;
  MERCADOPAGO_NOTIFICATION_URL?: string;
  PAYWAY_SITE_ID?: string;
  PAYWAY_PUBLIC_API_KEY?: string;
  PAYWAY_PRIVATE_API_KEY?: string;
  PAYWAY_API_BASE_URL?: string;
  PAYWAY_NOTIFICATION_URL?: string;
  PAYWAY_WEBHOOK_SECRET?: string;
  PUBLIC_WEB_URL?: string;
  CATALOG_CACHE_INVALIDATION_SECRET?: string;
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
  const mercadoPagoAccessToken = optionalValue(
    environment['MERCADOPAGO_ACCESS_TOKEN'],
  );
  const mercadoPagoPublicKey = optionalValue(
    environment['MERCADOPAGO_PUBLIC_KEY'],
  );
  const mercadoPagoWebhookSecret = optionalValue(
    environment['MERCADOPAGO_WEBHOOK_SECRET'],
  );
  const mercadoPagoNotificationUrl = optionalValue(
    environment['MERCADOPAGO_NOTIFICATION_URL'],
  );
  const publicWebUrl = optionalValue(environment['PUBLIC_WEB_URL']);
  const catalogCacheInvalidationSecret = optionalValue(
    environment['CATALOG_CACHE_INVALIDATION_SECRET'],
  );
  const paywaySiteId = optionalValue(environment['PAYWAY_SITE_ID']);
  const paywayPublicApiKey = optionalValue(
    environment['PAYWAY_PUBLIC_API_KEY'],
  );
  const paywayPrivateApiKey = optionalValue(
    environment['PAYWAY_PRIVATE_API_KEY'],
  );
  const paywayApiBaseUrl = optionalValue(environment['PAYWAY_API_BASE_URL']);
  const paywayNotificationUrl = optionalValue(
    environment['PAYWAY_NOTIFICATION_URL'],
  );
  const paywayWebhookSecret = optionalValue(
    environment['PAYWAY_WEBHOOK_SECRET'],
  );
  if (publicWebUrl)
    validateUrl(publicWebUrl, 'PUBLIC_WEB_URL', ['http:', 'https:']);
  if (mercadoPagoNotificationUrl)
    validateUrl(mercadoPagoNotificationUrl, 'MERCADOPAGO_NOTIFICATION_URL', [
      'http:',
      'https:',
    ]);
  if (paywayApiBaseUrl)
    validateUrl(paywayApiBaseUrl, 'PAYWAY_API_BASE_URL', ['https:']);
  if (paywayNotificationUrl)
    validateUrl(paywayNotificationUrl, 'PAYWAY_NOTIFICATION_URL', [
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
    ...(mercadoPagoAccessToken
      ? { MERCADOPAGO_ACCESS_TOKEN: mercadoPagoAccessToken }
      : {}),
    ...(mercadoPagoPublicKey
      ? { MERCADOPAGO_PUBLIC_KEY: mercadoPagoPublicKey }
      : {}),
    ...(mercadoPagoWebhookSecret
      ? { MERCADOPAGO_WEBHOOK_SECRET: mercadoPagoWebhookSecret }
      : {}),
    ...(mercadoPagoNotificationUrl
      ? { MERCADOPAGO_NOTIFICATION_URL: mercadoPagoNotificationUrl }
      : {}),
    ...(paywaySiteId ? { PAYWAY_SITE_ID: paywaySiteId } : {}),
    ...(paywayPublicApiKey
      ? { PAYWAY_PUBLIC_API_KEY: paywayPublicApiKey }
      : {}),
    ...(paywayPrivateApiKey
      ? { PAYWAY_PRIVATE_API_KEY: paywayPrivateApiKey }
      : {}),
    ...(paywayApiBaseUrl ? { PAYWAY_API_BASE_URL: paywayApiBaseUrl } : {}),
    ...(paywayNotificationUrl
      ? { PAYWAY_NOTIFICATION_URL: paywayNotificationUrl }
      : {}),
    ...(paywayWebhookSecret
      ? { PAYWAY_WEBHOOK_SECRET: paywayWebhookSecret }
      : {}),
    ...(publicWebUrl ? { PUBLIC_WEB_URL: publicWebUrl } : {}),
    ...(catalogCacheInvalidationSecret
      ? { CATALOG_CACHE_INVALIDATION_SECRET: catalogCacheInvalidationSecret }
      : {}),
  };
};

const optionalValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
