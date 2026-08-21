export type ApplicationEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  NODE_ENV: ApplicationEnvironment;
  PORT: number;
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
  };
};
