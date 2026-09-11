export type ApplicationEnvironment = 'development' | 'test' | 'production';
export type StorageProviderName = 'r2' | 'minio';

export interface EnvironmentVariables {
  DATABASE_URL: string;
  DIRECT_DATABASE_URL?: string;
  STORAGE_PROVIDER: StorageProviderName;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_PUBLIC_BASE_URL?: string;
  MINIO_ENDPOINT?: string;
  MINIO_REGION?: string;
  MINIO_ACCESS_KEY_ID?: string;
  MINIO_SECRET_ACCESS_KEY?: string;
  MINIO_PUBLIC_BASE_URL?: string;
  AUTH_JWT_ISSUER: string;
  AUTH_JWT_AUDIENCE: string;
  AUTH_JWT_PRIVATE_KEY_BASE64?: string;
  AUTH_JWT_PUBLIC_KEY_BASE64?: string;
  AUTH_ACCESS_TOKEN_TTL_SECONDS: number;
  AUTH_REFRESH_TOKEN_TTL_DAYS: number;
  AUTH_EMAIL_CONFIRMATION_TTL_MINUTES: number;
  AUTH_PASSWORD_RECOVERY_TTL_MINUTES: number;
  CLOUDFLARE_TURNSTILE_SECRET_KEY?: string;
  CLOUDFLARE_TURNSTILE_HOSTNAMES?: string;
  ORIGIN_VERIFY_SECRET?: string;
  NODE_ENV: ApplicationEnvironment;
  PORT: number;
  CORS_ORIGINS: string;
  MERCADOPAGO_ACCESS_TOKEN?: string;
  MERCADOPAGO_PUBLIC_KEY?: string;
  MERCADOPAGO_WEBHOOK_SECRET?: string;
  MERCADOPAGO_NOTIFICATION_URL?: string;
  PAYWAY_SITE_ID?: string;
  PAYWAY_SITE_ID_VISA?: string;
  PAYWAY_SITE_ID_MASTERCARD?: string;
  PAYWAY_SITE_ID_AMERICAN_EXPRESS?: string;
  PAYWAY_SITE_ID_DISCOVER?: string;
  PAYWAY_SITE_ID_CABAL?: string;
  PAYWAY_PRIVATE_API_KEY?: string;
  PAYWAY_API_BASE_URL?: string;
  PAYWAY_WEBHOOK_SECRET?: string;
  PUBLIC_WEB_URL?: string;
  CATALOG_EDGE_CACHE_ENABLED: boolean;
  VARNISH_PURGE_URL?: string;
  VARNISH_PURGE_SECRET?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_CACHE_PURGE_TOKEN?: string;
  NOTIFICATION_PROVIDER?: 'noop' | 'resend' | 'http' | 'smtp';
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_FROM_EMAIL?: string;
  SMTP_REPLY_TO?: string;
  SMTP_APP_URL?: string;
}

const requireValue = (environment: Record<string, unknown>, key: keyof EnvironmentVariables): string => {
  const value = environment[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`La variable ${key} es obligatoria.`);
  }
  return value.trim();
};

const validateUrl = (value: string, key: keyof EnvironmentVariables, protocols: string[]): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`La variable ${key} debe ser una URL válida.`);
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(`La variable ${key} debe usar uno de estos protocolos: ${protocols.join(', ')}.`);
  }
  return value;
};

export const validateEnvironment = (environment: Record<string, unknown>): EnvironmentVariables => {
  const rawNodeEnv = environment['NODE_ENV'];
  const nodeEnv = typeof rawNodeEnv === 'string' ? rawNodeEnv : 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV debe ser development, test o production.');
  }

  const production = nodeEnv === 'production';
  const rawStorageProvider = environment['STORAGE_PROVIDER'] ?? (production ? 'r2' : 'minio');
  if (rawStorageProvider !== 'r2' && rawStorageProvider !== 'minio') {
    throw new Error('STORAGE_PROVIDER debe ser r2 o minio.');
  }
  if (production && rawStorageProvider !== 'r2') {
    throw new Error('STORAGE_PROVIDER debe ser r2 en production.');
  }
  const storageProvider = rawStorageProvider;
  const r2AccountId = storageProvider === 'r2' ? requireValue(environment, 'R2_ACCOUNT_ID') : undefined;
  const r2AccessKeyId = storageProvider === 'r2' ? requireValue(environment, 'R2_ACCESS_KEY_ID') : undefined;
  const r2SecretAccessKey = storageProvider === 'r2' ? requireValue(environment, 'R2_SECRET_ACCESS_KEY') : undefined;
  const r2PublicBaseUrl =
    storageProvider === 'r2' ? validateUrl(requireValue(environment, 'R2_PUBLIC_BASE_URL'), 'R2_PUBLIC_BASE_URL', ['https:']) : undefined;
  const minioEndpoint =
    storageProvider === 'minio' ? validateUrl(requireValue(environment, 'MINIO_ENDPOINT'), 'MINIO_ENDPOINT', ['http:', 'https:']) : undefined;
  const minioAccessKeyId = storageProvider === 'minio' ? requireValue(environment, 'MINIO_ACCESS_KEY_ID') : undefined;
  const minioSecretAccessKey = storageProvider === 'minio' ? requireValue(environment, 'MINIO_SECRET_ACCESS_KEY') : undefined;
  const minioPublicBaseUrl =
    storageProvider === 'minio'
      ? validateUrl(requireValue(environment, 'MINIO_PUBLIC_BASE_URL'), 'MINIO_PUBLIC_BASE_URL', ['http:', 'https:'])
      : undefined;
  const authPrivateKey = optionalValue(environment['AUTH_JWT_PRIVATE_KEY_BASE64']);
  const authPublicKey = optionalValue(environment['AUTH_JWT_PUBLIC_KEY_BASE64']);
  const turnstileSecret = optionalValue(environment['CLOUDFLARE_TURNSTILE_SECRET_KEY']);
  const turnstileHostnames = parseTurnstileHostnames(environment['CLOUDFLARE_TURNSTILE_HOSTNAMES']);
  const originVerifySecret = optionalValue(environment['ORIGIN_VERIFY_SECRET']);
  if (production && (!authPrivateKey || !authPublicKey)) {
    throw new Error('AUTH_JWT_PRIVATE_KEY_BASE64 y AUTH_JWT_PUBLIC_KEY_BASE64 son obligatorias en production.');
  }
  if (production && (!turnstileSecret || turnstileHostnames.length === 0 || !originVerifySecret)) {
    throw new Error('CLOUDFLARE_TURNSTILE_SECRET_KEY, CLOUDFLARE_TURNSTILE_HOSTNAMES y ORIGIN_VERIFY_SECRET son obligatorias en production.');
  }
  if (production && turnstileHostnames.some((hostname) => hostname === 'localhost' || hostname === '127.0.0.1')) {
    throw new Error('CLOUDFLARE_TURNSTILE_HOSTNAMES no puede incluir localhost ni 127.0.0.1 en production.');
  }

  const port = Number(environment['PORT'] ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un puerto TCP válido.');
  }

  const rawCorsOrigins = environment['CORS_ORIGINS'];
  const corsOrigins = typeof rawCorsOrigins === 'string' && rawCorsOrigins.trim() ? rawCorsOrigins.trim() : 'http://localhost:3000';
  const mercadoPagoAccessToken = optionalValue(environment['MERCADOPAGO_ACCESS_TOKEN']);
  const mercadoPagoPublicKey = optionalValue(environment['MERCADOPAGO_PUBLIC_KEY']);
  const mercadoPagoWebhookSecret = optionalValue(environment['MERCADOPAGO_WEBHOOK_SECRET']);
  const mercadoPagoNotificationUrl = optionalValue(environment['MERCADOPAGO_NOTIFICATION_URL']);
  const publicWebUrl = optionalValue(environment['PUBLIC_WEB_URL']);
  const catalogEdgeCacheEnabled = readBoolean(environment['CATALOG_EDGE_CACHE_ENABLED'], false, 'CATALOG_EDGE_CACHE_ENABLED');
  const varnishPurgeUrl = optionalValue(environment['VARNISH_PURGE_URL']);
  const varnishPurgeSecret = optionalValue(environment['VARNISH_PURGE_SECRET']);
  const cloudflareZoneId = optionalValue(environment['CLOUDFLARE_ZONE_ID']);
  const cloudflareCachePurgeToken = optionalValue(environment['CLOUDFLARE_CACHE_PURGE_TOKEN']);
  const notificationProvider = optionalValue(environment['NOTIFICATION_PROVIDER']) ?? (production ? 'resend' : 'noop');
  if (!['noop', 'resend', 'http', 'smtp'].includes(notificationProvider)) {
    throw new Error('NOTIFICATION_PROVIDER debe ser noop, resend, http o smtp.');
  }
  const paywaySiteId = optionalValue(environment['PAYWAY_SITE_ID']);
  const paywaySiteIdVisa = optionalValue(environment['PAYWAY_SITE_ID_VISA']);
  const paywaySiteIdMastercard = optionalValue(environment['PAYWAY_SITE_ID_MASTERCARD']);
  const paywaySiteIdAmericanExpress = optionalValue(environment['PAYWAY_SITE_ID_AMERICAN_EXPRESS']);
  const paywaySiteIdDiscover = optionalValue(environment['PAYWAY_SITE_ID_DISCOVER']);
  const paywaySiteIdCabal = optionalValue(environment['PAYWAY_SITE_ID_CABAL']);
  const paywayPrivateApiKey = optionalValue(environment['PAYWAY_PRIVATE_API_KEY']);
  const paywayApiBaseUrl = optionalValue(environment['PAYWAY_API_BASE_URL']);
  const paywayWebhookSecret = optionalValue(environment['PAYWAY_WEBHOOK_SECRET']);
  const smtpHost = optionalValue(environment['SMTP_HOST']);
  const smtpFromEmail = optionalValue(environment['SMTP_FROM_EMAIL']);
  const smtpReplyTo = optionalValue(environment['SMTP_REPLY_TO']);
  const smtpAppUrl = optionalValue(environment['SMTP_APP_URL']);
  const smtpPort = environment['SMTP_PORT'] === undefined ? 1025 : readInteger(environment['SMTP_PORT'], 1025, 1, 65535);
  if (notificationProvider === 'smtp') {
    if (!smtpHost) requireValue(environment, 'SMTP_HOST');
    if (!smtpFromEmail) requireValue(environment, 'SMTP_FROM_EMAIL');
    validateUrl(requireValue(environment, 'SMTP_APP_URL'), 'SMTP_APP_URL', ['http:', 'https:']);
  }
  if (publicWebUrl) validateUrl(publicWebUrl, 'PUBLIC_WEB_URL', ['http:', 'https:']);
  if (varnishPurgeUrl) validateUrl(varnishPurgeUrl, 'VARNISH_PURGE_URL', ['http:', 'https:']);
  if (catalogEdgeCacheEnabled && (!varnishPurgeUrl || !varnishPurgeSecret)) {
    throw new Error('VARNISH_PURGE_URL y VARNISH_PURGE_SECRET son obligatorias cuando CATALOG_EDGE_CACHE_ENABLED=true.');
  }
  if (Boolean(cloudflareZoneId) !== Boolean(cloudflareCachePurgeToken)) {
    throw new Error('CLOUDFLARE_ZONE_ID y CLOUDFLARE_CACHE_PURGE_TOKEN deben configurarse juntos.');
  }
  if (mercadoPagoNotificationUrl) validateUrl(mercadoPagoNotificationUrl, 'MERCADOPAGO_NOTIFICATION_URL', ['http:', 'https:']);
  if (paywayApiBaseUrl) validateUrl(paywayApiBaseUrl, 'PAYWAY_API_BASE_URL', ['https:']);

  return {
    DATABASE_URL: validateUrl(requireValue(environment, 'DATABASE_URL'), 'DATABASE_URL', ['postgres:', 'postgresql:']),
    ...(optionalValue(environment['DIRECT_DATABASE_URL'])
      ? { DIRECT_DATABASE_URL: validateUrl(requireValue(environment, 'DIRECT_DATABASE_URL'), 'DIRECT_DATABASE_URL', ['postgres:', 'postgresql:']) }
      : {}),
    STORAGE_PROVIDER: storageProvider,
    ...(r2AccountId ? { R2_ACCOUNT_ID: r2AccountId } : {}),
    ...(r2AccessKeyId ? { R2_ACCESS_KEY_ID: r2AccessKeyId } : {}),
    ...(r2SecretAccessKey ? { R2_SECRET_ACCESS_KEY: r2SecretAccessKey } : {}),
    ...(r2PublicBaseUrl ? { R2_PUBLIC_BASE_URL: r2PublicBaseUrl } : {}),
    ...(minioEndpoint ? { MINIO_ENDPOINT: minioEndpoint } : {}),
    ...(storageProvider === 'minio' ? { MINIO_REGION: optionalValue(environment['MINIO_REGION']) ?? 'us-east-1' } : {}),
    ...(minioAccessKeyId ? { MINIO_ACCESS_KEY_ID: minioAccessKeyId } : {}),
    ...(minioSecretAccessKey ? { MINIO_SECRET_ACCESS_KEY: minioSecretAccessKey } : {}),
    ...(minioPublicBaseUrl ? { MINIO_PUBLIC_BASE_URL: minioPublicBaseUrl } : {}),
    AUTH_JWT_ISSUER: optionalValue(environment['AUTH_JWT_ISSUER']) ?? 'patitas-api',
    AUTH_JWT_AUDIENCE: optionalValue(environment['AUTH_JWT_AUDIENCE']) ?? 'patitas-clients',
    ...(authPrivateKey ? { AUTH_JWT_PRIVATE_KEY_BASE64: authPrivateKey } : {}),
    ...(authPublicKey ? { AUTH_JWT_PUBLIC_KEY_BASE64: authPublicKey } : {}),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: readInteger(environment['AUTH_ACCESS_TOKEN_TTL_SECONDS'], 900, 60, 3_600),
    AUTH_REFRESH_TOKEN_TTL_DAYS: readInteger(environment['AUTH_REFRESH_TOKEN_TTL_DAYS'], 30, 1, 90),
    AUTH_EMAIL_CONFIRMATION_TTL_MINUTES: readInteger(environment['AUTH_EMAIL_CONFIRMATION_TTL_MINUTES'], 1_440, 5, 2_880),
    AUTH_PASSWORD_RECOVERY_TTL_MINUTES: readInteger(environment['AUTH_PASSWORD_RECOVERY_TTL_MINUTES'], 30, 5, 120),
    ...(turnstileSecret ? { CLOUDFLARE_TURNSTILE_SECRET_KEY: turnstileSecret } : {}),
    ...(turnstileHostnames.length > 0 ? { CLOUDFLARE_TURNSTILE_HOSTNAMES: turnstileHostnames.join(',') } : {}),
    ...(originVerifySecret ? { ORIGIN_VERIFY_SECRET: originVerifySecret } : {}),
    NODE_ENV: nodeEnv as ApplicationEnvironment,
    PORT: port,
    CORS_ORIGINS: corsOrigins,
    ...(mercadoPagoAccessToken ? { MERCADOPAGO_ACCESS_TOKEN: mercadoPagoAccessToken } : {}),
    ...(mercadoPagoPublicKey ? { MERCADOPAGO_PUBLIC_KEY: mercadoPagoPublicKey } : {}),
    ...(mercadoPagoWebhookSecret ? { MERCADOPAGO_WEBHOOK_SECRET: mercadoPagoWebhookSecret } : {}),
    ...(mercadoPagoNotificationUrl ? { MERCADOPAGO_NOTIFICATION_URL: mercadoPagoNotificationUrl } : {}),
    ...(paywaySiteId ? { PAYWAY_SITE_ID: paywaySiteId } : {}),
    ...(paywaySiteIdVisa ? { PAYWAY_SITE_ID_VISA: paywaySiteIdVisa } : {}),
    ...(paywaySiteIdMastercard ? { PAYWAY_SITE_ID_MASTERCARD: paywaySiteIdMastercard } : {}),
    ...(paywaySiteIdAmericanExpress ? { PAYWAY_SITE_ID_AMERICAN_EXPRESS: paywaySiteIdAmericanExpress } : {}),
    ...(paywaySiteIdDiscover ? { PAYWAY_SITE_ID_DISCOVER: paywaySiteIdDiscover } : {}),
    ...(paywaySiteIdCabal ? { PAYWAY_SITE_ID_CABAL: paywaySiteIdCabal } : {}),
    ...(paywayPrivateApiKey ? { PAYWAY_PRIVATE_API_KEY: paywayPrivateApiKey } : {}),
    ...(paywayApiBaseUrl ? { PAYWAY_API_BASE_URL: paywayApiBaseUrl } : {}),
    ...(paywayWebhookSecret ? { PAYWAY_WEBHOOK_SECRET: paywayWebhookSecret } : {}),
    ...(publicWebUrl ? { PUBLIC_WEB_URL: publicWebUrl } : {}),
    CATALOG_EDGE_CACHE_ENABLED: catalogEdgeCacheEnabled,
    ...(varnishPurgeUrl ? { VARNISH_PURGE_URL: varnishPurgeUrl } : {}),
    ...(varnishPurgeSecret ? { VARNISH_PURGE_SECRET: varnishPurgeSecret } : {}),
    ...(cloudflareZoneId ? { CLOUDFLARE_ZONE_ID: cloudflareZoneId } : {}),
    ...(cloudflareCachePurgeToken ? { CLOUDFLARE_CACHE_PURGE_TOKEN: cloudflareCachePurgeToken } : {}),
    NOTIFICATION_PROVIDER: notificationProvider as EnvironmentVariables['NOTIFICATION_PROVIDER'],
    ...(smtpHost ? { SMTP_HOST: smtpHost } : {}),
    ...(notificationProvider === 'smtp' ? { SMTP_PORT: smtpPort } : {}),
    ...(smtpFromEmail ? { SMTP_FROM_EMAIL: smtpFromEmail } : {}),
    ...(smtpReplyTo ? { SMTP_REPLY_TO: smtpReplyTo } : {}),
    ...(smtpAppUrl ? { SMTP_APP_URL: smtpAppUrl } : {}),
  };
};

const optionalValue = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const readInteger = (value: unknown, fallback: number, minimum: number, maximum: number): number => {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`El valor ${String(value)} debe ser un entero entre ${minimum} y ${maximum}.`);
  }
  return parsed;
};

const readBoolean = (value: unknown, fallback: boolean, key: keyof EnvironmentVariables): boolean => {
  if (value === undefined || value === '') return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`La variable ${key} debe ser true o false.`);
};

const parseTurnstileHostnames = (value: unknown): string[] => {
  const raw = optionalValue(value);
  if (!raw) return [];

  const hostnames = raw
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  const invalidHostname = hostnames.find((hostname) => {
    try {
      const parsed = new URL(`https://${hostname}`);
      return (
        parsed.hostname !== hostname ||
        parsed.port !== '' ||
        parsed.pathname !== '/' ||
        parsed.search !== '' ||
        parsed.hash !== '' ||
        parsed.username !== '' ||
        parsed.password !== ''
      );
    } catch {
      return true;
    }
  });
  if (invalidHostname) {
    throw new Error(`CLOUDFLARE_TURNSTILE_HOSTNAMES contiene un hostname inválido: ${invalidHostname}.`);
  }

  return [...new Set(hostnames)];
};
