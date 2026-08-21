import { spawnSync } from 'node:child_process';
import { chmodSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const action = process.argv[2];
const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const runSupabase = (args, { inherit = false } = {}) => {
  const result = spawnSync(executable, ['exec', 'supabase', ...args], {
    encoding: 'utf8',
    env: process.env,
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const message = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .replace(/sb_secret_[A-Za-z0-9_-]+/g, '[REDACTED_SECRET]')
      .replace(/eyJ[A-Za-z0-9_.-]+/g, '[REDACTED_LEGACY_KEY]')
      .replace(
        /postgres(?:ql)?:\/\/[^\s"'@]+:[^\s"'@]+@/g,
        'postgresql://[REDACTED]@',
      );
    throw new Error(message || `Supabase terminó con código ${result.status}.`);
  }

  return result.stdout ?? '';
};

const requireCloudMajorVersion = () => {
  const value = process.env['SUPABASE_DB_MAJOR_VERSION'];
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(
      'SUPABASE_DB_MAJOR_VERSION es obligatoria y debe coincidir con Supabase Cloud.',
    );
  }
};

const statusJson = () => JSON.parse(runSupabase(['status', '-o', 'json']));

const resolveValue = (status, current, legacy) =>
  status[current] ?? status[legacy];

const syncEnvironment = () => {
  const status = statusJson();
  const databaseUrl = status.DB_URL;
  const supabaseUrl = status.API_URL;
  const publishableKey = resolveValue(status, 'PUBLISHABLE_KEY', 'ANON_KEY');
  const secretKey = resolveValue(status, 'SECRET_KEY', 'SERVICE_ROLE_KEY');

  if (!databaseUrl || !supabaseUrl || !publishableKey || !secretKey) {
    throw new Error(
      'Supabase CLI no devolvió DB_URL, API_URL y ambas API keys esperadas.',
    );
  }

  const databasePort = new URL(databaseUrl).port;
  const contents = [
    '# Generado por `pnpm infra:start`. No editar ni versionar.',
    `DATABASE_URL=${databaseUrl}`,
    `SUPABASE_URL=${supabaseUrl}`,
    `SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    `SUPABASE_SECRET_KEY=${secretKey}`,
    `SUPABASE_DB_PORT=${databasePort}`,
    '',
  ].join('\n');

  writeFileSync('.env.supabase.local', contents, { mode: 0o600 });
  chmodSync('.env.supabase.local', 0o600);
  process.env['DATABASE_URL'] = databaseUrl;
  process.env['SUPABASE_URL'] = supabaseUrl;
  process.env['SUPABASE_PUBLISHABLE_KEY'] = publishableKey;
  process.env['SUPABASE_SECRET_KEY'] = secretKey;
  process.env['SUPABASE_DB_PORT'] = databasePort;
};

const start = () => {
  requireCloudMajorVersion();
  runSupabase(['start']);
  syncEnvironment();
  console.log('Supabase local iniciado y entorno local sincronizado.');
};

const status = () => {
  const current = statusJson();
  const safeStatus = {
    apiUrl: current.API_URL ?? null,
    databaseHost: current.DB_URL ? new URL(current.DB_URL).host : null,
    studioUrl: current.STUDIO_URL ?? null,
  };
  console.log(JSON.stringify(safeStatus, null, 2));
};

const reset = () => {
  requireCloudMajorVersion();
  runSupabase(['stop', '--no-backup']);
  start();
  const deploy = spawnSync(executable, ['db:deploy'], {
    env: process.env,
    stdio: 'inherit',
  });
  if (deploy.status !== 0) process.exit(deploy.status ?? 1);
  const seed = spawnSync(executable, ['db:seed'], {
    env: process.env,
    stdio: 'inherit',
  });
  process.exit(seed.status ?? 1);
};

switch (action) {
  case 'start':
    start();
    break;
  case 'stop':
    runSupabase(['stop'], { inherit: true });
    break;
  case 'status':
    status();
    break;
  case 'reset':
    reset();
    break;
  default:
    throw new Error(
      `Acción de infraestructura desconocida: ${action ?? '(vacía)'}.`,
    );
}
