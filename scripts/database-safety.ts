const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

type Environment = NodeJS.ProcessEnv;

const isCommand = (args: string[], ...parts: string[]): boolean =>
  parts.every((part, index) => args[index] === part);

const readUrlOverride = (args: string[]): string | undefined => {
  const inline = args.find((arg) => arg.startsWith('--url='));
  if (inline) {
    return inline.slice('--url='.length);
  }

  const index = args.indexOf('--url');
  return index >= 0 ? args[index + 1] : undefined;
};

export const assertLocalDatabaseUrl = (
  rawUrl: string | undefined,
  environment: Environment = process.env,
): void => {
  if (!rawUrl) {
    throw new Error('DATABASE_URL es obligatoria para esta operación.');
  }

  if (environment['NODE_ENV'] === 'production') {
    throw new Error('Las operaciones locales están bloqueadas en production.');
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL no es una URL PostgreSQL válida.');
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL debe utilizar PostgreSQL.');
  }

  if (!LOOPBACK_HOSTS.has(databaseUrl.hostname)) {
    throw new Error(
      `Operación rechazada: ${databaseUrl.hostname} no es una base local.`,
    );
  }

  const expectedPort = environment['SUPABASE_DB_PORT'] ?? '54322';
  if (databaseUrl.port !== expectedPort) {
    throw new Error(
      `Operación rechazada: el puerto debe ser ${expectedPort}, recibido ${databaseUrl.port || '(vacío)'}.`,
    );
  }
};

export const assertSafePrismaCommand = (
  argv: string[],
  environment: Environment = process.env,
): void => {
  const prismaIndex = argv.findIndex((arg) =>
    /(?:^|[/\\])prisma(?:\.js)?$/.test(arg),
  );
  const args = argv.slice(prismaIndex >= 0 ? prismaIndex + 1 : 2);

  if (isCommand(args, 'db', 'push')) {
    throw new Error(
      'prisma db push está bloqueado: prisma/migrations es la fuente de verdad.',
    );
  }

  const localOnly =
    isCommand(args, 'migrate', 'dev') ||
    isCommand(args, 'migrate', 'reset') ||
    isCommand(args, 'db', 'seed');

  const requiresDatabase =
    localOnly ||
    isCommand(args, 'migrate', 'deploy') ||
    isCommand(args, 'migrate', 'status');

  const configuredUrl = environment['DATABASE_URL'];
  const effectiveUrl = readUrlOverride(args) ?? configuredUrl;

  if (requiresDatabase && !effectiveUrl) {
    throw new Error('DATABASE_URL es obligatoria para esta operación Prisma.');
  }

  if (localOnly) {
    assertLocalDatabaseUrl(effectiveUrl, environment);
  }
};
